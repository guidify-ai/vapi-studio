import { Injectable, Logger } from '@nestjs/common';
import {
  EventService,
  FormsService,
  SupervisedConversationRegistry,
  Supervisor,
  WorkflowHandoffService,
} from '@guidify-ai/vapi-studio';
import { StudioLiveSpeechBuffer } from '../studio/studio-live-speech.buffer';

/**
 * After forms.open() submit: run IdentityCollect and speak confirm.
 * Vapi: Live Call Control `controlUrl` say. Studio: live speech buffer.
 */
@Injectable()
export class FormResumeService {
  private readonly logger = new Logger(FormResumeService.name);

  constructor(
    private readonly forms: FormsService,
    private readonly registry: SupervisedConversationRegistry,
    private readonly supervisor: Supervisor,
    private readonly handoffs: WorkflowHandoffService,
    private readonly events: EventService,
    private readonly liveSpeech: StudioLiveSpeechBuffer,
  ) {}

  async afterSubmit(conversationId: string): Promise<string[]> {
    const runtime = this.registry.getByConversationId(conversationId);
    if (!runtime || runtime.status === 'ENDED') {
      this.events.log('warn', 'FORM_RESUME_NO_RUNTIME', { conversationId });
      return [];
    }
    if (!this.forms.hasUnclaimedSubmit(conversationId)) {
      return [];
    }

    this.handoffs.ensureActiveFlow(runtime);
    runtime.currentNodeId = 'identityCollect';
    runtime.normalFlowNodeId = 'identityCollect';

    const say: string[] = [];
    try {
      const turn = await this.supervisor.handleTurn({
        runtime,
        userText: '',
        forceIntention: 'isIdentityCollect',
        onSay: async (text) => {
          say.push(text);
          this.liveSpeech.push(conversationId, text);
        },
      });
      await this.handoffs.applyHandoffs(runtime, turn.actions);
    } catch (err) {
      this.events.log('error', 'FORM_RESUME_TURN_FAILED', {
        conversationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }

    const spoken = say.filter(Boolean).join(' ').trim();
    if (!spoken) {
      this.events.log('warn', 'FORM_RESUME_EMPTY_SAY', { conversationId });
      return [];
    }

    const controlUrl =
      typeof runtime.metadata.vapiControlUrl === 'string'
        ? runtime.metadata.vapiControlUrl
        : null;

    if (!controlUrl) {
      this.events.log('info', 'FORM_RESUME_STUDIO_OR_NO_CONTROL', {
        conversationId,
        providerCallId: runtime.providerCallId,
        chars: spoken.length,
        sayLines: say.length,
      });
      return say;
    }

    try {
      const res = await fetch(controlUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'say',
          content: spoken,
          endCallAfterSpoken: false,
        }),
      });
      this.events.log('info', 'FORM_RESUME_VAPI_SAY', {
        conversationId,
        providerCallId: runtime.providerCallId,
        httpStatus: res.status,
        chars: spoken.length,
      });
      if (!res.ok) {
        this.logger.warn(
          `Vapi control say failed HTTP ${res.status} for ${conversationId}`,
        );
      }
    } catch (err) {
      this.events.log('error', 'FORM_RESUME_VAPI_SAY_FAILED', {
        conversationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return say;
  }
}
