/**
 * Reserved Twilio SMS env contract for form sendout.
 * Live sends require the optional peer package `twilio` and dry-run off.
 */
export declare const TWILIO_SMS_ENV: {
    readonly accountSid: "TWILIO_ACCOUNT_SID";
    readonly authToken: "TWILIO_AUTH_TOKEN";
    readonly fromNumber: "TWILIO_FROM_NUMBER";
    readonly messagingServiceSid: "TWILIO_MESSAGING_SERVICE_SID";
    readonly dryRun: "TWILIO_SMS_DRY_RUN";
};
export interface TwilioSmsConfig {
    accountSid: string;
    authToken: string;
    /** E.164 from-number (mutually exclusive with messagingServiceSid in practice). */
    fromNumber?: string;
    messagingServiceSid?: string;
    /**
     * When true (default), log the intended SMS and do not call Twilio.
     * Set `TWILIO_SMS_DRY_RUN=0` only when ready for live traffic.
     */
    dryRun: boolean;
}
export type TwilioSmsConfigStatus = {
    ok: true;
    config: TwilioSmsConfig;
} | {
    ok: false;
    reason: string;
    config: TwilioSmsConfig;
};
/** Read reserved Twilio env vars (does not validate completeness for live send). */
export declare function readTwilioSmsConfig(env?: NodeJS.ProcessEnv): TwilioSmsConfig;
/**
 * Credentials ready for a live Twilio API call (dry-run may still be on).
 * Needs account + token + (from number XOR messaging service).
 */
export declare function twilioSmsCredentialsReady(config: TwilioSmsConfig): boolean;
export declare function resolveTwilioSmsConfig(env?: NodeJS.ProcessEnv): TwilioSmsConfigStatus;
/** Normalize NA mobile / E.164 for Twilio `to`. */
export declare function normalizeSmsToE164(raw: string): string | null;
export interface TwilioSmsDisposeContext {
    /** Destination mobile (E.164 or 10-digit NA). Aliases: `to`, `phone`. */
    contactPhone?: string;
    to?: string;
    phone?: string;
    /** Absolute HTTPS URL to the fillable form. */
    formUrl?: string;
    /** Optional full SMS body (otherwise a short default with formUrl). */
    body?: string;
}
export declare function pickSmsDestination(ctx: Record<string, unknown> | undefined): string | null;
export declare function pickSmsFormUrl(ctx: Record<string, unknown> | undefined): string | null;
export declare function buildDefaultSmsBody(formUrl: string): string;
export declare function resolveSmsBody(ctx: Record<string, unknown> | undefined, formUrl: string): string;
//# sourceMappingURL=twilio-sms.env.d.ts.map