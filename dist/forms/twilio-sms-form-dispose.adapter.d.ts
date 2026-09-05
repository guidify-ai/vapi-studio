import { EventService } from '../events/event.service';
import { FormsService } from './forms.service';
import type { FormDisposeAdapter, FormDisposePayload } from './form.types';
import { type TwilioSmsSender } from './twilio-sms.sender';
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
export declare class TwilioSmsFormDisposeAdapter implements FormDisposeAdapter {
    private readonly events?;
    private readonly forms?;
    /** Test double — when omitted, sender is built from env each dispose. */
    private readonly senderOverride?;
    readonly id: "twilio-sms";
    readonly branch: "sms";
    constructor(events?: EventService | undefined, forms?: FormsService | undefined, 
    /** Test double — when omitted, sender is built from env each dispose. */
    senderOverride?: TwilioSmsSender | undefined);
    dispose(payload: FormDisposePayload): Promise<void>;
    private persistOutboundError;
}
//# sourceMappingURL=twilio-sms-form-dispose.adapter.d.ts.map