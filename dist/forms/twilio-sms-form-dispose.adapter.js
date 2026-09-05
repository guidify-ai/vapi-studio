"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioSmsFormDisposeAdapter = void 0;
const common_1 = require("@nestjs/common");
const event_service_1 = require("../events/event.service");
const studio_event_1 = require("../events/studio-event");
const forms_service_1 = require("./forms.service");
const form_types_1 = require("./form.types");
const twilio_sms_env_1 = require("./twilio-sms.env");
const twilio_sms_sender_1 = require("./twilio-sms.sender");
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
let TwilioSmsFormDisposeAdapter = class TwilioSmsFormDisposeAdapter {
    events;
    forms;
    senderOverride;
    id = 'twilio-sms';
    branch = 'sms';
    constructor(events, forms, senderOverride) {
        this.events = events;
        this.forms = forms;
        this.senderOverride = senderOverride;
    }
    async dispose(payload) {
        const resolved = (0, twilio_sms_env_1.resolveTwilioSmsConfig)();
        if (!resolved.ok && !resolved.config.dryRun) {
            await this.persistOutboundError(payload, resolved.reason);
            throw new form_types_1.FormChannelUnavailableError(resolved.reason);
        }
        const to = (0, twilio_sms_env_1.pickSmsDestination)(payload.disposeContext);
        if (!to) {
            const reason = 'Twilio SMS dispose needs disposeContext.contactPhone (E.164 or 10-digit NA)';
            await this.persistOutboundError(payload, reason);
            throw new form_types_1.FormChannelUnavailableError(reason);
        }
        const formUrl = (0, twilio_sms_env_1.pickSmsFormUrl)(payload.disposeContext);
        if (!formUrl) {
            const reason = 'Twilio SMS dispose needs disposeContext.formUrl';
            await this.persistOutboundError(payload, reason);
            throw new form_types_1.FormChannelUnavailableError(reason);
        }
        const body = (0, twilio_sms_env_1.resolveSmsBody)(payload.disposeContext, formUrl);
        const sender = this.senderOverride ?? (0, twilio_sms_sender_1.createTwilioSmsSender)(resolved.config);
        let result;
        try {
            result = await sender.send({ to, body });
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            await this.persistOutboundError(payload, reason, { to, body });
            throw err instanceof Error
                ? err
                : new form_types_1.FormChannelUnavailableError(reason);
        }
        // Produce → listeners (Postgres) → conversation_events.
        await this.events?.persist(payload.conversationId, studio_event_1.STUDIO_EVENTS.OUTBOUND_NOTIFICATION, {
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
        });
        // Delivery accepted — ACK so FormsService can emit FORM_DELIVERED.
        this.forms?.ack(payload.exposeId);
    }
    async persistOutboundError(payload, reason, extra = {}) {
        if (!this.events || !payload.conversationId)
            return;
        await this.events.persist(payload.conversationId, studio_event_1.STUDIO_EVENTS.OUTBOUND_NOTIFICATION_ERROR, {
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
        });
    }
};
exports.TwilioSmsFormDisposeAdapter = TwilioSmsFormDisposeAdapter;
exports.TwilioSmsFormDisposeAdapter = TwilioSmsFormDisposeAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => forms_service_1.FormsService))),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [event_service_1.EventService,
        forms_service_1.FormsService, Object])
], TwilioSmsFormDisposeAdapter);
//# sourceMappingURL=twilio-sms-form-dispose.adapter.js.map