import type { Request } from 'express';

/** Best-effort client IP (honors first X-Forwarded-For hop when proxied). */
export function clientIpFromRequest(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim().slice(0, 64);
  }
  if (Array.isArray(xf) && xf[0]) {
    return String(xf[0]).split(',')[0].trim().slice(0, 64);
  }
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  return String(raw).replace(/^::ffff:/, '').slice(0, 64);
}

export function utcDayStart(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function conversationsPerDayLimit(): number {
  const n = Number(process.env.RATE_LIMIT_CONVERSATIONS_PER_DAY || 3);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}
