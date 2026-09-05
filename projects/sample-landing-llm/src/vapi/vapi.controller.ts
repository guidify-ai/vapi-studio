import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CallTurnQueueRegistry,
  ConversationBootstrapService,
  EventService,
  ProviderIngressRepository,
  Supervisor,
  SupervisedConversationRegistry,
  VapiSseCompiler,
  WorkflowHandoffService,
  WorkflowLoader,
  extractNewestUserText,
  extractToolFunctionNames,
  extractAdvertisedTools,
  extractToolResults,
  extractVapiCallId,
  extractVapiCallerNumber,
  hasAdvertisedHandoffTool,
  CHANNEL_META,
  listenTimeoutSecondsToMs,
  rememberCallerPhone,
  type OutputAction,
  type SupervisedConversation,
  type VapiTurnContext,
} from '@guidify-ai/vapi-studio';
import { VapiWebhookGuard } from './vapi.guard';
import { VapiWebhookHandler } from './vapi.handler';
import { extractVapiControlUrl } from './vapi-control-url';
import { brainConfig } from '../brain/brain.config';
import {
  phoneCaller,
  withCallerMetadata,
} from '../caller/caller-identity';
import {
  ProjectUuidGuard,
  projectIdFromRequest,
} from '../project/project-uuid.guard';
import { projectVapiBasePath } from '../project/project.config';

@Controller(':projectUuid/vapi')
@UseGuards(ProjectUuidGuard)
export class VapiController {
  constructor(
    private readonly webhookHandler: VapiWebhookHandler,
    private readonly registry: SupervisedConversationRegistry,
    private readonly bootstrap: ConversationBootstrapService,
    private readonly supervisor: Supervisor,
    private readonly events: EventService,
    private readonly ingress: ProviderIngressRepository,
    private readonly turnQueues: CallTurnQueueRegistry,
    private readonly handoffs: WorkflowHandoffService,
    private readonly workflows: WorkflowLoader,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @UseGuards(VapiWebhookGuard)
  async webhook(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    const projectId = projectIdFromRequest(req);
    const result = await this.webhookHandler.handle(body, projectId);
    return result.body ?? { ok: true };
  }

  /** Default Custom LLM URL (entry / shared). */
  @Post('chat/completions')
  async chatCompletions(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res() res: Response,
  ): Promise<void> {
    return this.handleCustomLlm({
      projectId: projectIdFromRequest(req),
      body,
      headers,
      req,
      res,
      moduleHint: null,
    });
  }

  /**
   * Per-module Custom LLM URL for Vapi Squad members:
   * POST /:projectUuid/vapi/:moduleId/chat/completions
   * Also accepts header X-Studio-Module.
   */
  @Post(':moduleId/chat/completions')
  async chatCompletionsForModule(
    @Req() req: Request,
    @Param('moduleId') moduleId: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res() res: Response,
  ): Promise<void> {
    return this.handleCustomLlm({
      projectId: projectIdFromRequest(req),
      body,
      headers,
      req,
      res,
      moduleHint: moduleId,
    });
  }

  private resolveModuleHint(
    pathModule: string | null,
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    if (pathModule?.trim()) return pathModule.trim();
    const header = headers['x-studio-module'];
    if (typeof header === 'string' && header.trim()) return header.trim();
    if (Array.isArray(header) && header[0]?.trim()) return header[0].trim();
    return null;
  }

  private alignActiveModule(
    runtime: SupervisedConversation,
    moduleHint: string | null,
  ): void {
    if (!this.workflows.hasWorkflow()) return;
    if (moduleHint) {
      try {
        const mod = this.workflows.getModule(moduleHint);
        runtime.metadata.activeModuleId = mod.id;
        runtime.metadata.workflowId = this.workflows.getWorkflow().id;
      } catch {
        const byAssistant =
          this.workflows.findModuleIdByAssistantName(moduleHint);
        if (byAssistant) {
          runtime.metadata.activeModuleId = byAssistant;
          runtime.metadata.workflowId = this.workflows.getWorkflow().id;
        }
      }
    }
    this.handoffs.ensureActiveFlow(runtime);
  }

  private async handleCustomLlm(input: {
    projectId: string;
    body: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
    req: Request;
    res: Response;
    moduleHint: string | null;
  }): Promise<void> {
    const { projectId, body, headers, req, res } = input;
    const moduleHint = this.resolveModuleHint(input.moduleHint, headers);
    const callId =
      extractVapiCallId(body) ??
      (typeof headers['x-call-id'] === 'string' ? headers['x-call-id'] : null) ??
      (typeof headers['x-vapi-call-id'] === 'string'
        ? headers['x-vapi-call-id']
        : null);
    const callerPhoneNumber = extractVapiCallerNumber(body);
    if (callId && callerPhoneNumber) {
      rememberCallerPhone(callId, callerPhoneNumber);
    }

    const ingressPath = moduleHint
      ? `${projectVapiBasePath(projectId)}/${moduleHint}/chat/completions`
      : `${projectVapiBasePath(projectId)}/chat/completions`;
    const ingressRow = await this.ingress.record({
      projectId,
      kind: 'custom-llm',
      path: ingressPath,
      providerCallId: callId,
      messageType: 'chat.completions',
      headers: headers as Record<string, unknown>,
      body,
    });

    this.events.log('info', 'CUSTOM_LLM_REQUEST', {
      callId,
      projectId,
      ingressId: ingressRow.id,
      headerKeys: Object.keys(headers),
      bodyKeys: Object.keys(body),
      hasMessages: Array.isArray(body.messages),
      callerPhoneNumber,
      moduleHint,
    });

    if (!callId) {
      await this.ingress.setResponse(ingressRow.id, 400, {
        error: 'missing_call_id',
      });
      res.status(400).json({
        error: 'missing_call_id',
        message:
          'Could not correlate Custom LLM request to a Vapi call id. Logged body/header keys for operator inspection.',
      });
      return;
    }

    let runtime = this.registry.getByProviderCallId(callId);
    if (callerPhoneNumber && runtime) {
      runtime.metadata.callerPhoneNumber = callerPhoneNumber;
      runtime.metadata.channel = 'phone';
      runtime.metadata.callerId = callerPhoneNumber;
      runtime.metadata.caller = phoneCaller(callerPhoneNumber);
      const vars = runtime.variables as Record<string, unknown>;
      vars.callerChannel = 'phone';
      vars.callerId = callerPhoneNumber;
    }
    if (!runtime) {
      const brainProfileId = process.env.POC_BRAIN_PROFILE || 'planner';
      const base = {
        messageType: 'custom-llm-lazy-bootstrap',
        brainProfileId,
        projectId,
      };
      runtime = await this.bootstrap.bootstrap({
        projectId,
        providerCallId: callId,
        brainProfileId,
        metadata: callerPhoneNumber
          ? withCallerMetadata(base, phoneCaller(callerPhoneNumber))
          : base,
      });
      this.handoffs.activateEntryModule(runtime);
      this.events.log('info', 'CUSTOM_LLM_LAZY_BOOTSTRAP', {
        providerCallId: callId,
        projectId,
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        brainProfileId,
        callerId: callerPhoneNumber ?? null,
        callerChannel: callerPhoneNumber ? 'phone' : null,
        activeModuleId: runtime.metadata.activeModuleId ?? null,
      });
    }

    this.alignActiveModule(runtime, moduleHint);

    const controlUrl = extractVapiControlUrl(body as Record<string, unknown>);
    if (controlUrl) {
      runtime.metadata.vapiControlUrl = controlUrl;
    }

    const userText = extractNewestUserText(
      body as { messages?: Array<{ role?: string; content?: unknown }> },
    );
    const toolResults = extractToolResults(
      body as { messages?: Array<{ role?: string; content?: unknown }> },
    );
    runtime.metadata[CHANNEL_META.tools] = extractAdvertisedTools(body.tools);
    const vapiCtx: VapiTurnContext = {
      callId,
      assistantId:
        typeof (body as { assistant?: { id?: string } }).assistant?.id ===
        'string'
          ? (body as { assistant: { id: string } }).assistant.id
          : typeof body.assistantId === 'string'
            ? body.assistantId
            : null,
      phoneNumber: callerPhoneNumber,
      customer:
        body.customer && typeof body.customer === 'object'
          ? (body.customer as Record<string, unknown>)
          : null,
      metadata:
        body.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, unknown>)
          : null,
      model: typeof body.model === 'string' ? body.model : null,
    };
    runtime.metadata[CHANNEL_META.vapi] = vapiCtx;

    const queue = this.turnQueues.get(callId);

    if (queue.isWorking) {
      this.events.log('info', 'CUSTOM_LLM_TURN_QUEUED', {
        providerCallId: callId,
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        userText,
        pendingCount: queue.pendingCount + (userText.trim() ? 1 : 0),
      });
    }

    let aborted = false;
    const interruptible =
      runtime.listenExpectation?.interruptible !== false;
    req.on('close', () => {
      if (res.writableEnded) {
        return;
      }
      if (!interruptible) {
        this.events.log('info', 'CUSTOM_LLM_OVERLAP', {
          providerCallId: callId,
          runtimeInstanceId: runtime.runtimeInstanceId,
          note: 'uninterruptible listen — overlapping POST queued, not aborted',
        });
        return;
      }
      aborted = true;
      runtime.turn.interrupted = true;
      runtime.turn.lastInterruptAt = new Date().toISOString();
      this.events.log('info', 'CUSTOM_LLM_ABORT', {
        providerCallId: callId,
        runtimeInstanceId: runtime.runtimeInstanceId,
      });
    });

    try {
      if (!res.headersSent) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }

      const uninterruptibleHold =
        runtime.listenExpectation?.interruptible === false &&
        runtime.openingCompleted;
      const useListenHold =
        uninterruptibleHold ||
        (brainConfig.adapter === 'mock' && runtime.openingCompleted);
      const outcome = await queue.runExclusive({
        userText,
        listenHoldMs: useListenHold
          ? listenTimeoutSecondsToMs(
              runtime.listenExpectation?.timeoutSeconds,
            )
          : 0,
        continueDraining: () => false,
        work: async (combinedUserText, meta) => {
          this.events.log('info', 'CUSTOM_LLM_TURN', {
            providerCallId: callId,
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            userText: combinedUserText,
            series: meta.series,
            parts: meta.parts,
            turnNumber: runtime.turn.turnNumber + 1,
            activeModuleId: runtime.metadata.activeModuleId ?? null,
            memory: { ...runtime.memory },
          });

          if (!res.headersSent) {
            res.status(200);
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
          }

          const compiler = new VapiSseCompiler({ tools: body.tools });
          const writer = {
            write: (chunk: string) => {
              if (!aborted) {
                res.write(chunk);
              }
            },
            end: () => {
              /* leader ends once below */
            },
          };

          runtime.lastAssistantSpeech = [];
          this.handoffs.ensureActiveFlow(runtime);
          const turn = await this.supervisor.handleTurn({
            runtime,
            userText: combinedUserText,
            toolResults,
            onSay: async (text) => {
              runtime.lastAssistantSpeech.push(text);
              if (aborted) {
                return;
              }
              this.events.log('info', 'SAY', {
                providerCallId: callId,
                runtimeInstanceId: runtime.runtimeInstanceId,
                text,
                turnNumber: runtime.turn.turnNumber,
              });
              compiler.writeAssistantText(writer, text);
            },
          });

          if (aborted) {
            return { aborted: true as const, turn };
          }

          let actions: OutputAction[] = await this.handoffs.applyHandoffs(
            runtime,
            turn.actions,
          );
          const handoffActions = actions.filter((a) => a.kind === 'handoff');
          if (handoffActions.length > 0 && !hasAdvertisedHandoffTool(body.tools)) {
            this.events.log('warn', 'HANDOFF_TOOL_NOT_ADVERTISED', {
              providerCallId: callId,
              runtimeInstanceId: runtime.runtimeInstanceId,
              activeModuleId: runtime.metadata.activeModuleId ?? null,
              destinations: handoffActions.map((a) => a.assistantName ?? a.handoffTo),
              note:
                'Convention desync: Node handed off but this Custom LLM body.tools has no handoff tool. Pre-provision type:handoff destinations on the Squad member assistant (assistantName must match workflow.yaml).',
            });
          }
          const genericToolCalls = actions.filter((a) => a.kind === 'toolCall');
          if (genericToolCalls.length > 0) {
            const advertised = extractToolFunctionNames(body.tools);
            const missing = genericToolCalls
              .map((a) => a.toolCall?.name)
              .filter((n): n is string => typeof n === 'string' && n.length > 0)
              .filter((n) => advertised.length > 0 && !advertised.includes(n));
            if (missing.length > 0) {
              this.events.log('warn', 'TOOL_CALL_NOT_ADVERTISED', {
                providerCallId: callId,
                runtimeInstanceId: runtime.runtimeInstanceId,
                activeModuleId: runtime.metadata.activeModuleId ?? null,
                missing,
                advertised,
                note:
                  'Convention desync: Node requested tool name(s) not on this Custom LLM body.tools. Pre-provision them on the Vapi assistant model.tools (Vapi Studio requests blindly; Vapi must already have them).',
              });
            }
          }
          // continueTo (same assistant): speak destination entry now.
          // Squad handoff: leave moduleNeedsEntrySpeak for the next Custom LLM
          // request after Vapi switches members.
          const hadContinueTo = actions.some((a) => a.kind === 'continueTo');
          if (hadContinueTo && handoffActions.length === 0) {
            let guard = 0;
            while (
              runtime.metadata.moduleNeedsEntrySpeak === true &&
              guard < 4 &&
              !aborted
            ) {
              guard += 1;
              const entry = await this.supervisor.handleTurn({
                runtime,
                userText: '',
                onSay: async (text) => {
                  runtime.lastAssistantSpeech.push(text);
                  if (aborted) return;
                  compiler.writeAssistantText(writer, text);
                },
              });
              actions = [
                ...actions,
                ...(await this.handoffs.applyHandoffs(runtime, entry.actions)),
              ];
            }
          }

          const { emittedTools } = await compiler.streamTerminalActions(
            writer,
            actions,
          );
          if (emittedTools.length > 0) {
            this.events.log('info', 'TOOL_CALL_EMITTED', {
              providerCallId: callId,
              runtimeInstanceId: runtime.runtimeInstanceId,
              emittedTools,
              advertisedTools: Array.isArray(body.tools) ? body.tools : [],
              activeModuleId: runtime.metadata.activeModuleId ?? null,
            });
          }

          return {
            aborted: false as const,
            turn: { ...turn, actions },
            emittedTools,
          };
        },
      });

      if (outcome.status === 'skipped') {
        const replay = [...runtime.lastAssistantSpeech];
        this.events.log('info', 'CUSTOM_LLM_TURN_SKIPPED', {
          providerCallId: callId,
          conversationId: runtime.conversationId,
          runtimeInstanceId: runtime.runtimeInstanceId,
          userText,
          reason: 'coalesced_by_leader',
          replayed: replay.length,
        });
        await this.ingress.setResponse(ingressRow.id, 200, {
          skipped: true,
          reason: 'coalesced_by_leader',
          replayed: replay.length,
        });
        if (!res.headersSent) {
          res.status(200);
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
        }
        const compiler = new VapiSseCompiler({ tools: body.tools });
        const writer = {
          write: (chunk: string) => {
            res.write(chunk);
          },
          end: () => {
            if (!res.writableEnded) res.end();
          },
        };
        compiler.replayAssistantSpeech(writer, replay);
        await compiler.streamTerminalActions(writer, []);
        writer.end();
        return;
      }

      const result = outcome.result;
      if (result.aborted) {
        await this.ingress.setResponse(ingressRow.id, 499, { aborted: true });
        if (!res.writableEnded) res.end();
        return;
      }

      await this.ingress.setResponse(ingressRow.id, 200, {
        streamed: true,
        selectedNodeId: result.turn.selectedNodeId,
        selectedClass: result.turn.selectedClass,
        intentionNames: result.turn.intentionNames,
        actions: result.turn.actions,
        emittedTools: result.emittedTools,
        activeModuleId: runtime.metadata.activeModuleId ?? null,
      });
      if (!res.writableEnded) res.end();
    } catch (error) {
      this.events.log('error', 'CUSTOM_LLM_ERROR', {
        providerCallId: callId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.ingress.setResponse(ingressRow.id, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'turn_failed' });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  }
}
