/**
 * Stable caller identification for the PoC.
 * - web (Flow Studio): browser cookie `studio_caller_id`
 * - phone (Vapi): ANI / caller phone number
 */
export type CallerChannel = 'web' | 'phone';

export interface CallerIdentity {
  channel: CallerChannel;
  /** Cookie UUID (web) or E.164 / dialed number (phone). */
  id: string;
}

export function resolveCaller(
  metadata?: Record<string, unknown>,
): CallerIdentity | null {
  if (!metadata) return null;

  const nested = metadata.caller;
  if (nested && typeof nested === 'object') {
    const c = nested as Record<string, unknown>;
    if (
      (c.channel === 'web' || c.channel === 'phone') &&
      typeof c.id === 'string' &&
      c.id.trim()
    ) {
      return { channel: c.channel, id: c.id.trim() };
    }
  }

  if (typeof metadata.callerPhoneNumber === 'string' && metadata.callerPhoneNumber.trim()) {
    return { channel: 'phone', id: metadata.callerPhoneNumber.trim() };
  }

  if (typeof metadata.callerId === 'string' && metadata.callerId.trim()) {
    const channel: CallerChannel =
      metadata.channel === 'phone' ? 'phone' : 'web';
    return { channel, id: metadata.callerId.trim() };
  }

  return null;
}

export function webCaller(callerId: string): CallerIdentity {
  return { channel: 'web', id: callerId.trim() };
}

export function phoneCaller(phone: string): CallerIdentity {
  return { channel: 'phone', id: phone.trim() };
}

/** Merge caller fields into bootstrap / runtime metadata. */
export function withCallerMetadata(
  base: Record<string, unknown>,
  caller: CallerIdentity,
): Record<string, unknown> {
  return {
    ...base,
    channel: caller.channel,
    callerId: caller.id,
    caller,
    ...(caller.channel === 'phone' ? { callerPhoneNumber: caller.id } : {}),
  };
}

/** Prefer body callerId, then `studio_caller_id` cookie. */
export function readWebCallerIdFromRequest(
  cookieHeader: string | undefined,
  bodyCallerId?: string,
): string | null {
  const fromBody = bodyCallerId?.trim();
  if (fromBody) return fromBody;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)studio_caller_id=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}
