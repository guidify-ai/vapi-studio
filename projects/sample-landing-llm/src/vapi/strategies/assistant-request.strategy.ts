import { Injectable } from '@nestjs/common';
import {
  ConversationBootstrapService,
  DEFAULT_LISTEN_TIMEOUT_SECONDS,
  EventService,
  WorkflowHandoffService,
  WorkflowLoader,
  listenTimeoutToVapiStartSpeakingPlan,
} from '@guidify-ai/vapi-studio';
import {
  phoneCaller,
  withCallerMetadata,
} from '../../caller/caller-identity';
import {
  projectChatCompletionsUrl,
  projectWebhookUrl,
} from '../../project/project.config';
import { extractPlannerIntakeMetadata } from '../extract-planner-intake-metadata';
import type {
  VapiStrategy,
  VapiMessageType,
  VapiWebhookCommand,
  VapiWebhookResponse,
} from '../vapi.types';

/** Idle: 30s → still-there ask (×2), then StillThereNode may endCall. */
const STILL_THERE_TIMEOUT_SECONDS = 30;
/**
 * Vapi hard silence hangup. Saved assistants set this in the dashboard —
 * keep this in sync (operator raised to 120s for form waits).
 * Note: while a form is pending we skip still-there, but Vapi still ends the
 * call at this hard timeout if the caller stays silent. Prefer ≥ fill time
 * for slow HTML forms (e.g. 300–600) if 120s proves tight.
 */
const SILENCE_HARD_TIMEOUT_SECONDS = Number(
  process.env.VAPI_SILENCE_TIMEOUT_SECONDS?.trim() || 120,
);

/**
 * Build Vapi `customer.speech.timeout` hooks.
 * Server tool `studio_still_there` → ToolCallsStrategy → StillThereNode.
 * Do **not** attach `type:endCall` on the hook — StillThereNode decides
 * (and skips ending while a form expose is pending).
 */
function stillThereHooks(webhookUrl: string): unknown[] {
  const stillThereTool = {
    type: 'function',
    function: {
      name: 'studio_still_there',
      description:
        'Vapi Studio idle portal — ask if the caller is still there (server-dispatched).',
      parameters: { type: 'object', properties: {} },
    },
    server: { url: webhookUrl },
    messages: [
      {
        type: 'request-complete',
        content: '',
        // Empty content → Vapi speaks the tool result string from our webhook.
      },
    ],
  };

  return [
    {
      on: 'customer.speech.timeout',
      name: 'studio_still_there_ask',
      options: {
        timeoutSeconds: STILL_THERE_TIMEOUT_SECONDS,
        triggerMaxCount: 2,
        triggerResetMode: 'onUserSpeech',
      },
      do: [{ type: 'tool', tool: stillThereTool }],
    },
    {
      on: 'customer.speech.timeout',
      name: 'studio_still_there_end',
      options: {
        timeoutSeconds: STILL_THERE_TIMEOUT_SECONDS * 3,
        triggerMaxCount: 1,
        triggerResetMode: 'onUserSpeech',
      },
      // StillThereNode endCalls after attempts; no hard endCall here so form
      // fillout can no-op the tool without Vapi hanging up anyway.
      do: [{ type: 'tool', tool: stillThereTool }],
    },
  ];
}

/** Tools this single PoC assistant must advertise (matches Studio SSE names). */
function singleAssistantTools(webhookUrl: string): unknown[] {
  const endCallName =
    process.env.VAPI_END_CALL_TOOL_NAME?.trim() || 'end_call_tool';
  const transferName =
    process.env.VAPI_TRANSFER_CALL_TOOL_NAME?.trim() || 'transferCall';
  const transferDest = process.env.VAPI_TRANSFER_DESTINATION?.trim();

  const tools: unknown[] = [
    { type: 'endCall' },
    {
      type: 'function',
      function: {
        name: endCallName,
        description: 'End the call (Vapi Studio farewell / goodbye).',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'studio_still_there',
        description:
          'Idle portal — injected by customer.speech.timeout hooks.',
        parameters: { type: 'object', properties: {} },
      },
      server: { url: webhookUrl },
    },
  ];

  if (transferDest) {
    tools.push({
      type: 'transferCall',
      destinations: [{ type: 'number', number: transferDest }],
    });
    tools.push({
      type: 'function',
      function: {
        name: transferName,
        description: 'Transfer the caller to a human (Vapi Studio portal).',
        parameters: {
          type: 'object',
          properties: {
            destination: { type: 'string' },
          },
        },
      },
    });
  }

  return tools;
}

@Injectable()
export class AssistantRequestStrategy implements VapiStrategy {
  constructor(
    private readonly bootstrap: ConversationBootstrapService,
    private readonly events: EventService,
    private readonly handoffs: WorkflowHandoffService,
    private readonly workflows: WorkflowLoader,
  ) {}

  supports(type: VapiMessageType): boolean {
    return type === 'assistant-request';
  }

  async handle(command: VapiWebhookCommand): Promise<VapiWebhookResponse> {
    const fromPayload =
      typeof command.raw.brainProfile === 'string'
        ? command.raw.brainProfile
        : undefined;
    const brainProfileId =
      fromPayload || process.env.POC_BRAIN_PROFILE || 'planner';
    const intake = extractPlannerIntakeMetadata(command.raw);
    const base = {
      messageType: command.type,
      brainProfileId,
      projectId: command.projectId,
      ...intake,
    };
    const runtime = await this.bootstrap.bootstrap({
      projectId: command.projectId,
      providerCallId: command.callId,
      brainProfileId,
      metadata: command.callerPhoneNumber
        ? withCallerMetadata(base, phoneCaller(command.callerPhoneNumber))
        : base,
    });
    this.handoffs.activateEntryModule(runtime);

    const squad = this.workflows.hasWorkflow();
    const savedAssistantId =
      process.env.POC_ASSISTANT_ID?.trim() ||
      process.env.VAPI_ASSISTANT_ID?.trim() ||
      '';

    this.events.log('info', 'ASSISTANT_REQUEST', {
      providerCallId: command.callId,
      projectId: command.projectId,
      conversationId: runtime.conversationId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      brainProfileId,
      callerId: command.callerPhoneNumber ?? null,
      callerChannel: command.callerPhoneNumber ? 'phone' : null,
      activeModuleId: runtime.metadata.activeModuleId ?? null,
      singleAssistant: !squad,
      assistantId: savedAssistantId || null,
    });

    // Preferred: one saved Vapi assistant (operator creates exactly one).
    if (savedAssistantId && !squad) {
      return { body: { assistantId: savedAssistantId } };
    }

    const publicBase = (
      process.env.PUBLIC_BASE_URL ?? 'http://localhost:9999'
    ).replace(/\/$/, '');
    const webhookUrl = projectWebhookUrl(publicBase, command.projectId);

    // Default PoC path: one transient assistant, flat Custom LLM URL.
    // Squad-only: per-module URL when workflow.yaml is loaded.
    const customLlmUrl = projectChatCompletionsUrl(
      publicBase,
      command.projectId,
      squad
        ? typeof runtime.metadata.activeModuleId === 'string'
          ? runtime.metadata.activeModuleId
          : 'router'
        : null,
    );

    return {
      body: {
        assistant: {
          name: 'Vapi Studio Sample',
          model: {
            provider: 'custom-llm',
            url: customLlmUrl,
            model: 'studio-poc',
            tools: singleAssistantTools(webhookUrl),
          },
          silenceTimeoutSeconds: SILENCE_HARD_TIMEOUT_SECONDS,
          hooks: stillThereHooks(webhookUrl),
          startSpeakingPlan: listenTimeoutToVapiStartSpeakingPlan(
            DEFAULT_LISTEN_TIMEOUT_SECONDS,
          ),
        },
      },
    };
  }
}
