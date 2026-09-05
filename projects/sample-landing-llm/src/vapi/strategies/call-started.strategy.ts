import { Injectable } from '@nestjs/common';
import {
  ConversationBootstrapService,
  EventService,
  WorkflowHandoffService,
} from '@guidify-ai/vapi-studio';
import {
  phoneCaller,
  withCallerMetadata,
} from '../../caller/caller-identity';
import { extractPlannerIntakeMetadata } from '../extract-planner-intake-metadata';
import type {
  VapiStrategy,
  VapiMessageType,
  VapiWebhookCommand,
  VapiWebhookResponse,
} from '../vapi.types';

/**
 * Vapi often sends `assistant.started` (static assistant + Custom LLM)
 * instead of `assistant-request`. Bootstrap the supervised Conversation here.
 */
@Injectable()
export class CallStartedStrategy implements VapiStrategy {
  constructor(
    private readonly bootstrap: ConversationBootstrapService,
    private readonly events: EventService,
    private readonly handoffs: WorkflowHandoffService,
  ) {}

  supports(type: VapiMessageType): boolean {
    return (
      type === 'assistant.started' ||
      type === 'assistant-started' ||
      type === 'call.started' ||
      type === 'call-started'
    );
  }

  async handle(command: VapiWebhookCommand): Promise<VapiWebhookResponse> {
    const brainProfileId = process.env.POC_BRAIN_PROFILE || 'planner';
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

    this.events.log('info', 'CALL_STARTED_BOOTSTRAP', {
      providerCallId: command.callId,
      projectId: command.projectId,
      conversationId: runtime.conversationId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      messageType: command.type,
      brainProfileId,
      callerId: command.callerPhoneNumber ?? null,
      callerChannel: command.callerPhoneNumber ? 'phone' : null,
      activeModuleId: runtime.metadata.activeModuleId ?? null,
    });

    return { body: { ok: true } };
  }
}
