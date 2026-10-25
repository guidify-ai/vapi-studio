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

/**
 * Accept an E.164 number (`+` country code + subscriber), tolerating spaces,
 * dashes, dots and parentheses. National formats are rejected — the country
 * is the app's knowledge, so the app normalizes before dispose.
 */
export function normalizeSmsToE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+')) return null;
  const compact = `+${trimmed.slice(1).replace(/[\s().-]/g, '')}`;
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

/** Placeholder replaced with the form URL inside `disposeContext.body`. */
export const SMS_FORM_URL_PLACEHOLDER = '{formUrl}';

export interface TwilioSmsDisposeContext {
  /** Destination mobile in E.164 (`+15550100999`). Aliases: `to`, `phone`. */
  contactPhone?: string;
  to?: string;
  phone?: string;
  /** Absolute HTTPS URL to the fillable form. */
  formUrl?: string;
  /**
   * SMS text (required). `{formUrl}` is replaced with the form URL — the
   * recipient reads it, so the app owns the wording and language.
   */
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

/**
 * Absolute form URL for SMS: prefer `disposeContext.formUrl`, else
 * `{PUBLIC_BASE_URL}/{PROJECT_UUID}/forms/{exposeId}` when PROJECT_UUID is set
 * (ngrok-helper routes by UUID), else `{PUBLIC_BASE_URL}/forms/{exposeId}`.
 */
export function resolveSmsFormUrl(
  ctx: Record<string, unknown> | undefined,
  exposeId: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const fromCtx = pickSmsFormUrl(ctx);
  if (fromCtx) return fromCtx;
  const id = typeof exposeId === 'string' ? exposeId.trim() : '';
  if (!id) return null;
  const base = (env.PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (!base) return null;
  const projectUuid = (env.PROJECT_UUID ?? '').trim().toLowerCase();
  if (projectUuid) {
    return `${base}/${projectUuid}/forms/${id}`;
  }
  return `${base}/forms/${id}`;
}

/** App SMS text with `{formUrl}` filled in; null when the app sent none. */
export function resolveSmsBody(
  ctx: Record<string, unknown> | undefined,
  formUrl: string,
): string | null {
  const body = ctx && typeof ctx.body === 'string' ? ctx.body.trim() : '';
  if (!body) return null;
  return body.split(SMS_FORM_URL_PLACEHOLDER).join(formUrl);
}
