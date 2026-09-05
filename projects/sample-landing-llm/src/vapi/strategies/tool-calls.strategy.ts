import { Injectable } from '@nestjs/common';
import {
  EventService,
  FormsService,
  STANDARD_INTENTIONS,
  SupervisedConversationRegistry,
  Supervisor,
  WorkflowHandoffService,
  type OutputAction,
  type SupervisedConversation,
} from '@guidify-ai/vapi-studio';
import type {
  VapiStrategy,
  VapiMessageType,
  VapiWebhookCommand,
  VapiWebhookResponse,
} from '../vapi.types';

const STILL_THERE_TOOL = 'studio_still_there';

/**
 * Server-dispatched Vapi `tool-calls` (distinct from Custom LLM–requested tools).
 *
 * - `studio_still_there`: idle hook → Supervisor `forceIntention(studio.isStillThere)`.
 *   Result text is what Vapi should speak (tool request-complete / say).
 *   No-op while a form expose is pending (caller filling HTML, not ghosting).
 * - Other tools: ACK with empty/passthrough results + event (wire-ready).
 */
@Injectable()
export class ToolCallsStrategy implements VapiStrategy {
  constructor(
    private readonly registry: SupervisedConversationRegistry,
    private readonly supervisor: Supervisor,
    private readonly events: EventService,
    private readonly handoffs: WorkflowHandoffService,
    private readonly forms: FormsService,
  ) {}

  supports(type: VapiMessageType): boolean {
    return type === 'tool-calls';
  }

  async handle(command: VapiWebhookCommand): Promise<VapiWebhookResponse> {
    const toolCallList = this.extractToolCallList(command.raw);
    const runtime = this.registry.getByProviderCallId(command.callId);

    const results: Array<{ toolCallId: string; result: string }> = [];
    let endCallRequested = false;

    for (const tc of toolCallList) {
      if (tc.name === STILL_THERE_TOOL) {
        const outcome = await this.runStillThere(command.callId, runtime, tc);
        results.push({
          toolCallId: tc.id,
          result: outcome.spoken || 'ok',
        });
        if (outcome.endCall) endCallRequested = true;
        continue;
      }

      this.events.log('info', 'SERVER_TOOL_CALL_ACK', {
        providerCallId: command.callId,
        toolCallId: tc.id,
        name: tc.name,
        note: 'No server executor yet — passthrough ACK for LLM-vs-server tool split.',
      });
      results.push({
        toolCallId: tc.id,
        result: JSON.stringify({ ok: true, name: tc.name }),
      });
    }

    const body: Record<string, unknown> = { results };
    if (endCallRequested) {
      // Hint for operators / future control-plane; Vapi hooks should also
      // attach type:endCall on the final idle timeout.
      body.studioEndCall = true;
    }
    return { body };
  }

  private async runStillThere(
    callId: string,
    runtime: SupervisedConversation | undefined,
    tc: { id: string; name: string },
  ): Promise<{ spoken: string; endCall: boolean }> {
    if (!runtime || runtime.status === 'ENDED') {
      this.events.log('warn', 'STILL_THERE_NO_RUNTIME', {
        providerCallId: callId,
        toolCallId: tc.id,
      });
      return {
        spoken: 'Are you still there?',
        endCall: false,
      };
    }

    // Form fillout holds Custom LLM open; silence is expected — do not ask /
    // endCall or preempt the wait TTS mid-sentence.
    if (this.forms.getPending(runtime.conversationId)) {
      this.events.log('info', 'STILL_THERE_SKIPPED_FORM_PENDING', {
        providerCallId: callId,
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        toolCallId: tc.id,
        note: 'HTML form expose awaiting submit — silence is expected',
      });
      return { spoken: '', endCall: false };
    }

    // Non-blocking open(): submit parked values — resume identity instead of idle ask.
    if (this.forms.hasUnclaimedSubmit(runtime.conversationId)) {
      this.handoffs.ensureActiveFlow(runtime);
      runtime.currentNodeId = 'identityCollect';
      runtime.normalFlowNodeId = 'identityCollect';
      const say: string[] = [];
      const turn = await this.supervisor.handleTurn({
        runtime,
        userText: '',
        forceIntention: 'isIdentityCollect',
        onSay: async (text) => {
          say.push(text);
        },
      });
      const actions: OutputAction[] = await this.handoffs.applyHandoffs(
        runtime,
        turn.actions,
      );
      const endCall = actions.some((a) => a.kind === 'endCall');
      this.events.log('info', 'STILL_THERE_FORM_RESUME', {
        providerCallId: callId,
        conversationId: runtime.conversationId,
        say,
      });
      return {
        spoken: say.filter(Boolean).join(' ').trim() || 'ok',
        endCall,
      };
    }

    this.handoffs.ensureActiveFlow(runtime);
    const say: string[] = [];
    const turn = await this.supervisor.handleTurn({
      runtime,
      userText: '',
      forceIntention: STANDARD_INTENTIONS.isStillThere,
      onSay: async (text) => {
        say.push(text);
      },
    });
    const actions: OutputAction[] = await this.handoffs.applyHandoffs(
      runtime,
      turn.actions,
    );
    const endCall = actions.some((a) => a.kind === 'endCall');
    if (endCall) {
      runtime.status = 'ENDED';
    }

    this.events.log('info', 'STILL_THERE_SERVER_TOOL', {
      providerCallId: callId,
      conversationId: runtime.conversationId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      attempt: runtime.portalState.stillThere.attempts,
      endCall,
      say,
    });

    return {
      spoken: say.filter(Boolean).join(' ').trim(),
      endCall,
    };
  }

  private extractToolCallList(
    raw: Record<string, unknown>,
  ): Array<{ id: string; name: string; arguments?: unknown }> {
    const list = raw.toolCallList;
    if (!Array.isArray(list)) return [];
    const out: Array<{ id: string; name: string; arguments?: unknown }> = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id : '';
      const name =
        typeof row.name === 'string'
          ? row.name
          : typeof (row.function as { name?: string } | undefined)?.name ===
              'string'
            ? (row.function as { name: string }).name
            : '';
      if (!id || !name) continue;
      out.push({ id, name, arguments: row.arguments });
    }
    return out;
  }
}
