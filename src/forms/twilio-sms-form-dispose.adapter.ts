import {
  forwardRef,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { EventService } from '../events/event.service';
import { STUDIO_EVENTS } from '../events/studio-event';
import { FormsService } from './forms.service';
import type {
  FormDisposeAdapter,
  FormDisposePayload,
} from './form.types';
import { FormChannelUnavailableError } from './form.types';
import {
  pickSmsDestination,
  pickSmsFormUrl,
  resolveSmsBody,
  resolveTwilioSmsConfig,
} from './twilio-sms.env';
import {
  createTwilioSmsSender,
  type TwilioSmsSender,
} from './twilio-sms.sender';

/**
 * Form sendout driver — texts a form URL via Twilio.
 *
 * Env (reserved): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
 * `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`,
 * `TWILIO_SMS_DRY_RUN` (default **on** — prepare mode, no live API).
 *
 * On success (dry-run or live) emits `OUTBOUND_NOTIFICATION` via EventService
 * → listeners (Postgres by default) → `conversation_events`.
 *
 * Wire: `VapiStudioModule.forRoot({ formDisposeAdapter: TwilioSmsFormDisposeAdapter })`.
 * Install peer `twilio` only when leaving dry-run for live sends.
 */
@Injectable()
export class TwilioSmsFormDisposeAdapter implements FormDisposeAdapter {
  public readonly id: "twilio-sms" = 'twilio-sms';
  public readonly branch: "sms" = 'sms';

  public constructor(
    @Optional() private readonly events?: EventService,
    @Optional()
    @Inject(forwardRef(() => FormsService))
    private readonly forms?: FormsService,
    /** Test double — when omitted, sender is built from env each dispose. */
    @Optional() private readonly senderOverride?: TwilioSmsSender,
  ) {}

  public async dispose(payload: FormDisposePayload): Promise<void> {
    const resolved = resolveTwilioSmsConfig();
    if (!resolved.ok && !resolved.config.dryRun) {
      await this.persistOutboundError(payload, resolved.reason);
      throw new FormChannelUnavailableError(resolved.reason);
    }

    const to = pickSmsDestination(payload.disposeContext);
    if (!to) {
      const reason =
        'Twilio SMS dispose needs disposeContext.contactPhone (E.164 or 10-digit NA)';
      await this.persistOutboundError(payload, reason);
      throw new FormChannelUnavailableError(reason);
    }
    const formUrl = pickSmsFormUrl(payload.disposeContext);
    if (!formUrl) {
      const reason = 'Twilio SMS dispose needs disposeContext.formUrl';
      await this.persistOutboundError(payload, reason);
      throw new FormChannelUnavailableError(reason);
    }
    const body = resolveSmsBody(payload.disposeContext, formUrl);

    const sender =
      this.senderOverride ?? createTwilioSmsSender(resolved.config);

    let result;
    try {
      result = await sender.send({ to, body });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.persistOutboundError(payload, reason, { to, body });
      throw err instanceof Error
        ? err
        : new FormChannelUnavailableError(reason);
    }

    // Produce → listeners (Postgres) → conversation_events.
    await this.events?.persist(
      payload.conversationId,
      STUDIO_EVENTS.OUTBOUND_NOTIFICATION,
      {
        channel: 'sms',
        provider: 'twilio',
        status: result.dryRun ? 'dry_run' : 'sent',
        exposeId: payload.exposeId,
        formId: payload.formId,
        branch: payload.branch ?? null,
        deliveryBranch: this.branch,
        adapter: this.id,
        to: result.to,
        body: result.body,
        sid: result.sid,
        dryRun: result.dryRun,
      },
    );

    // Delivery accepted — ACK so FormsService can emit FORM_DELIVERED.
    this.forms?.ack(payload.exposeId);
  }

  private async persistOutboundError(
    payload: FormDisposePayload,
    reason: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.events || !payload.conversationId) return;
    await this.events.persist(
      payload.conversationId,
      STUDIO_EVENTS.OUTBOUND_NOTIFICATION_ERROR,
      {
        channel: 'sms',
        provider: 'twilio',
        status: 'error',
        exposeId: payload.exposeId,
        formId: payload.formId,
        branch: payload.branch ?? null,
        deliveryBranch: this.branch,
        adapter: this.id,
        reason,
        ...extra,
      },
    );
  }
}
