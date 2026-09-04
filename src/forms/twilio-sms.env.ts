/**
 * Reserved Twilio SMS env contract for form sendout.
 * Live sends require the optional peer package `twilio` and dry-run off.
 */

export const TWILIO_SMS_ENV = {
  accountSid: 'TWILIO_ACCOUNT_SID',
  authToken: 'TWILIO_AUTH_TOKEN',
  fromNumber: 'TWILIO_FROM_NUMBER',
  messagingServiceSid: 'TWILIO_MESSAGING_SERVICE_SID',
  dryRun: 'TWILIO_SMS_DRY_RUN',
} as const;

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

export type TwilioSmsConfigStatus =
  | { ok: true; config: TwilioSmsConfig }
  | { ok: false; reason: string; config: TwilioSmsConfig };

function envFlag(name: string, defaultOn: boolean): boolean {
  const raw = (process.env[name] ?? (defaultOn ? '1' : '0')).trim().toLowerCase();
  if (defaultOn) {
    return !['0', 'false', 'no', 'off'].includes(raw);
  }
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

/** Read reserved Twilio env vars (does not validate completeness for live send). */
export function readTwilioSmsConfig(
  env: NodeJS.ProcessEnv = process.env,
): TwilioSmsConfig {
  const accountSid = (env[TWILIO_SMS_ENV.accountSid] ?? '').trim();
  const authToken = (env[TWILIO_SMS_ENV.authToken] ?? '').trim();
  const fromNumber = (env[TWILIO_SMS_ENV.fromNumber] ?? '').trim() || undefined;
  const messagingServiceSid =
    (env[TWILIO_SMS_ENV.messagingServiceSid] ?? '').trim() || undefined;
  return {
    accountSid,
    authToken,
    fromNumber,
    messagingServiceSid,
    dryRun: envFlag(TWILIO_SMS_ENV.dryRun, true),
  };
}

/**
 * Credentials ready for a live Twilio API call (dry-run may still be on).
 * Needs account + token + (from number XOR messaging service).
 */
export function twilioSmsCredentialsReady(config: TwilioSmsConfig): boolean {
  if (!config.accountSid || !config.authToken) return false;
  const from = Boolean(config.fromNumber);
  const ms = Boolean(config.messagingServiceSid);
  return from !== ms; // exactly one sender identity
}

export function resolveTwilioSmsConfig(
  env: NodeJS.ProcessEnv = process.env,
): TwilioSmsConfigStatus {
  const config = readTwilioSmsConfig(env);
  if (config.dryRun) {
    return { ok: true, config };
  }
  if (!config.accountSid || !config.authToken) {
    return {
      ok: false,
      reason: `Set ${TWILIO_SMS_ENV.accountSid} and ${TWILIO_SMS_ENV.authToken} (or keep ${TWILIO_SMS_ENV.dryRun}=1)`,
      config,
    };
  }
  if (!config.fromNumber && !config.messagingServiceSid) {
    return {
      ok: false,
      reason: `Set ${TWILIO_SMS_ENV.fromNumber} or ${TWILIO_SMS_ENV.messagingServiceSid}`,
      config,
    };
  }
  if (config.fromNumber && config.messagingServiceSid) {
    return {
      ok: false,
      reason: `Set only one of ${TWILIO_SMS_ENV.fromNumber} / ${TWILIO_SMS_ENV.messagingServiceSid}`,
      config,
    };
  }
  return { ok: true, config };
}

/** Normalize NA mobile / E.164 for Twilio `to`. */
export function normalizeSmsToE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

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

export function pickSmsDestination(
  ctx: Record<string, unknown> | undefined,
): string | null {
  if (!ctx) return null;
  for (const key of ['contactPhone', 'to', 'phone'] as const) {
    const v = ctx[key];
    if (typeof v === 'string' && v.trim()) {
      return normalizeSmsToE164(v);
    }
  }
  return null;
}

export function pickSmsFormUrl(
  ctx: Record<string, unknown> | undefined,
): string | null {
  if (!ctx) return null;
  const v = ctx.formUrl;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function buildDefaultSmsBody(formUrl: string): string {
  return `Please fill out this short form: ${formUrl}`;
}

export function resolveSmsBody(
  ctx: Record<string, unknown> | undefined,
  formUrl: string,
): string {
  if (ctx && typeof ctx.body === 'string' && ctx.body.trim()) {
    return ctx.body.trim();
  }
  return buildDefaultSmsBody(formUrl);
}
