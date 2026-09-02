/**
 * JWT HS256 (HMAC) helpers for outbound integration auth.
 * No extra dependency — Node crypto only.
 */

import { createHmac, createHash, timingSafeEqual } from 'crypto';

export const INTEGRATION_SIGNATURE_HEADER = 'x-signature';

export interface IntegrationJwtClaims {
  iat: number;
  exp: number;
  method: string;
  url: string;
  bodySha256: string;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

export function sha256Hex(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export function canonicalRequestBody(body: unknown): string {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  return JSON.stringify(body);
}

export function readSecretEnv(secretEnvKey: string): string {
  const key = secretEnvKey.trim();
  if (!key) {
    throw new Error('Integration secretEnvKey must be a non-empty .env key name');
  }
  const secret = process.env[key];
  if (!secret) {
    throw new Error(
      `Integration HMAC secret missing: process.env.${key} is empty. ` +
        `Set that .env key for this integration.`,
    );
  }
  return secret;
}

export function signHs256Jwt(
  claims: Record<string, unknown>,
  secret: string,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const sig = createHmac('sha256', secret)
    .update(signingInput)
    .digest();
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export function verifyHs256Jwt(
  token: string,
  secret: string,
): IntegrationJwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT: expected header.payload.signature');
  }
  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac('sha256', secret).update(signingInput).digest();
  const actual = base64UrlDecode(encodedSig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Invalid JWT HMAC signature');
  }
  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid JWT payload');
  }
  const claims = payload as IntegrationJwtClaims;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && now > claims.exp) {
    throw new Error('JWT expired');
  }
  return claims;
}

/**
 * Sign the exact body bytes that will be sent.
 * JWT is placed on `x-signature` by the integration client.
 */
export function signIntegrationRequest(input: {
  secret: string;
  method: string;
  url: string;
  body: string;
  ttlSeconds?: number;
}): { token: string; bodySha256: string; claims: IntegrationJwtClaims } {
  const now = Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 60;
  const method = input.method.toUpperCase();
  const bodySha256 = sha256Hex(input.body);
  const claims: IntegrationJwtClaims = {
    iat: now,
    exp: now + ttl,
    method,
    url: input.url,
    bodySha256,
  };
  return {
    token: signHs256Jwt({ ...claims }, input.secret),
    bodySha256,
    claims,
  };
}
