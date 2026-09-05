"use strict";
/**
 * Reserved Twilio SMS env contract for form sendout.
 * Live sends require the optional peer package `twilio` and dry-run off.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TWILIO_SMS_ENV = void 0;
exports.readTwilioSmsConfig = readTwilioSmsConfig;
exports.twilioSmsCredentialsReady = twilioSmsCredentialsReady;
exports.resolveTwilioSmsConfig = resolveTwilioSmsConfig;
exports.normalizeSmsToE164 = normalizeSmsToE164;
exports.pickSmsDestination = pickSmsDestination;
exports.pickSmsFormUrl = pickSmsFormUrl;
exports.buildDefaultSmsBody = buildDefaultSmsBody;
exports.resolveSmsBody = resolveSmsBody;
exports.TWILIO_SMS_ENV = {
    accountSid: 'TWILIO_ACCOUNT_SID',
    authToken: 'TWILIO_AUTH_TOKEN',
    fromNumber: 'TWILIO_FROM_NUMBER',
    messagingServiceSid: 'TWILIO_MESSAGING_SERVICE_SID',
    dryRun: 'TWILIO_SMS_DRY_RUN',
};
function envFlag(name, defaultOn) {
    const raw = (process.env[name] ?? (defaultOn ? '1' : '0')).trim().toLowerCase();
    if (defaultOn) {
        return !['0', 'false', 'no', 'off'].includes(raw);
    }
    return ['1', 'true', 'yes', 'on'].includes(raw);
}
/** Read reserved Twilio env vars (does not validate completeness for live send). */
function readTwilioSmsConfig(env = process.env) {
    const accountSid = (env[exports.TWILIO_SMS_ENV.accountSid] ?? '').trim();
    const authToken = (env[exports.TWILIO_SMS_ENV.authToken] ?? '').trim();
    const fromNumber = (env[exports.TWILIO_SMS_ENV.fromNumber] ?? '').trim() || undefined;
    const messagingServiceSid = (env[exports.TWILIO_SMS_ENV.messagingServiceSid] ?? '').trim() || undefined;
    return {
        accountSid,
        authToken,
        fromNumber,
        messagingServiceSid,
        dryRun: envFlag(exports.TWILIO_SMS_ENV.dryRun, true),
    };
}
/**
 * Credentials ready for a live Twilio API call (dry-run may still be on).
 * Needs account + token + (from number XOR messaging service).
 */
function twilioSmsCredentialsReady(config) {
    if (!config.accountSid || !config.authToken)
        return false;
    const from = Boolean(config.fromNumber);
    const ms = Boolean(config.messagingServiceSid);
    return from !== ms; // exactly one sender identity
}
function resolveTwilioSmsConfig(env = process.env) {
    const config = readTwilioSmsConfig(env);
    if (config.dryRun) {
        return { ok: true, config };
    }
    if (!config.accountSid || !config.authToken) {
        return {
            ok: false,
            reason: `Set ${exports.TWILIO_SMS_ENV.accountSid} and ${exports.TWILIO_SMS_ENV.authToken} (or keep ${exports.TWILIO_SMS_ENV.dryRun}=1)`,
            config,
        };
    }
    if (!config.fromNumber && !config.messagingServiceSid) {
        return {
            ok: false,
            reason: `Set ${exports.TWILIO_SMS_ENV.fromNumber} or ${exports.TWILIO_SMS_ENV.messagingServiceSid}`,
            config,
        };
    }
    if (config.fromNumber && config.messagingServiceSid) {
        return {
            ok: false,
            reason: `Set only one of ${exports.TWILIO_SMS_ENV.fromNumber} / ${exports.TWILIO_SMS_ENV.messagingServiceSid}`,
            config,
        };
    }
    return { ok: true, config };
}
/** Normalize NA mobile / E.164 for Twilio `to`. */
function normalizeSmsToE164(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    if (/^\+[1-9]\d{7,14}$/.test(trimmed))
        return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 10)
        return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1'))
        return `+${digits}`;
    if (digits.length >= 8 && digits.length <= 15)
        return `+${digits}`;
    return null;
}
function pickSmsDestination(ctx) {
    if (!ctx)
        return null;
    for (const key of ['contactPhone', 'to', 'phone']) {
        const v = ctx[key];
        if (typeof v === 'string' && v.trim()) {
            return normalizeSmsToE164(v);
        }
    }
    return null;
}
function pickSmsFormUrl(ctx) {
    if (!ctx)
        return null;
    const v = ctx.formUrl;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
}
function buildDefaultSmsBody(formUrl) {
    return `Please fill out this short form: ${formUrl}`;
}
function resolveSmsBody(ctx, formUrl) {
    if (ctx && typeof ctx.body === 'string' && ctx.body.trim()) {
        return ctx.body.trim();
    }
    return buildDefaultSmsBody(formUrl);
}
//# sourceMappingURL=twilio-sms.env.js.map