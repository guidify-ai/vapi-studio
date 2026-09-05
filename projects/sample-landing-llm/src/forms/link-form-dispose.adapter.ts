import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EventService,
  FormsService,
  type FormDisposeAdapter,
  type FormDisposePayload,
} from '@guidify-ai/vapi-studio';

/**
 * First-party form dispose: publish a fillable HTML URL and ACK delivery.
 * Twilio SMS can plug in later — for now the link is logged + persisted so
 * operators (and the caller on a shared device) can open GET /forms/:exposeId.
 */
@Injectable()
export class LinkFormDisposeAdapter implements FormDisposeAdapter {
  readonly id = 'studio-first-party-html';
  /** Delivery lane: first-party HTML link (Twilio SMS would be `sms`). */
  readonly branch = 'html_link';
  private readonly logger = new Logger(LinkFormDisposeAdapter.name);

  constructor(
    private readonly events: EventService,
    private readonly moduleRef: ModuleRef,
  ) {}

  formUrl(exposeId: string): string {
    const base = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:9999').replace(
      /\/$/,
      '',
    );
    return `${base}/forms/${exposeId}`;
  }

  async dispose(payload: FormDisposePayload): Promise<void> {
    const publicUrl = this.formUrl(payload.exposeId);
    const localUrl = this.localFormUrl(payload.exposeId);
    const liveWatcher = this.localLiveWatcherUrl();
    const contactPhone =
      typeof payload.disposeContext?.contactPhone === 'string'
        ? payload.disposeContext.contactPhone
        : null;
    const channel =
      typeof payload.disposeContext?.channel === 'string'
        ? payload.disposeContext.channel
        : null;

    await this.events.persist(payload.conversationId, 'FORM_LINK_READY', {
      exposeId: payload.exposeId,
      formId: payload.formId,
      branch: payload.branch ?? null,
      deliveryBranch: this.branch,
      adapter: this.id,
      url: publicUrl,
      localUrl,
      liveWatcher,
      contactPhone,
      channel,
      fields: payload.fields.map((f) => f.name),
      note:
        'No Twilio — open /forms/inbox on this Mac, click the pending form, submit (bot resumes).',
    });

    // Loud operator banner (daily log + console).
    const banner = [
      '========== FORM READY (no Twilio) ==========',
      `Inbox:      ${liveWatcher}`,
      `Local form: ${localUrl}`,
      `Public URL: ${publicUrl}`,
      'Open the inbox, click the form, submit → bot continues.',
      '===========================================',
    ].join('\n');
    this.logger.log(banner);
    // eslint-disable-next-line no-console
    console.log(banner);

    // Delivery ACK = link is openable (Studio may also ACK when the modal opens).
    const forms = this.moduleRef.get(FormsService, { strict: false });
    forms.ack(payload.exposeId);
  }

  /** Always localhost so operators open the form on this machine. */
  localFormUrl(exposeId: string): string {
    const port = process.env.PORT ?? '9999';
    return `http://localhost:${port}/forms/${exposeId}`;
  }

  localLiveWatcherUrl(): string {
    const port = process.env.PORT ?? '9999';
    return `http://localhost:${port}/forms/inbox`;
  }
}
