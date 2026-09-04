import { Injectable } from '@nestjs/common';
import { EventService } from '../events/event.service';
import { STUDIO_EVENTS } from '../events/studio-event';
import {
  INTEGRATION_SIGNATURE_HEADER,
  canonicalRequestBody,
  readSecretEnv,
  signIntegrationRequest,
} from './jwt-hmac';

export type IntegrationHttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE';

export interface IntegrationRequestMeta {
  conversationId?: string;
  runtimeInstanceId?: string;
  providerCallId?: string;
}

export interface IntegrationRequest {
  /** Stable name for events / debug (e.g. "roofr.availability"). */
  name: string;
  url: string;
  method?: IntegrationHttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * Name of the .env key that holds this integration's HMAC secret.
   * Example: "ROOFR_API_JWT_SECRET"
   */
  secretEnvKey: string;
  timeoutMs?: number;
  ttlSeconds?: number;
  meta?: IntegrationRequestMeta;
}

export interface IntegrationResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T | string | null;
  headers: Record<string, string>;
  durationMs: number;
  bodySha256: string;
}

const MAX_STORED_BODY_CHARS = 8_192;

function clipBody(value: unknown): unknown {
  if (value == null) return value;
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (raw.length <= MAX_STORED_BODY_CHARS) return value;
  return `${raw.slice(0, MAX_STORED_BODY_CHARS)}…`;
}

function responseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Pre-baked outbound HTTP client: JWT HS256 over the body, `x-signature` header.
 * Every attempt emits INTEGRATION_REQUEST / RESPONSE / ERROR for listeners.
 */
@Injectable()
export class IntegrationClient {
  public constructor(private readonly events: EventService) {}

  public async request<T = unknown>(
    input: IntegrationRequest,
  ): Promise<IntegrationResponse<T>> {
    const method = (input.method ?? 'POST').toUpperCase() as IntegrationHttpMethod;
    const rawBody = method === 'GET' ? '' : canonicalRequestBody(input.body);
    const secret = readSecretEnv(input.secretEnvKey);
    const signed = signIntegrationRequest({
      secret,
      method,
      url: input.url,
      body: rawBody,
      ttlSeconds: input.ttlSeconds,
    });

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(input.headers ?? {}),
      [INTEGRATION_SIGNATURE_HEADER]: signed.token,
    };
    if (rawBody && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }

    const started = Date.now();
    await this.events.emit({
      type: STUDIO_EVENTS.INTEGRATION_REQUEST,
      conversationId: input.meta?.conversationId,
      runtimeInstanceId: input.meta?.runtimeInstanceId,
      providerCallId: input.meta?.providerCallId,
      payload: {
        name: input.name,
        method,
        url: input.url,
        secretEnvKey: input.secretEnvKey,
        headers: { ...headers },
        body: clipBody(method === 'GET' ? undefined : input.body ?? rawBody),
        bodySha256: signed.bodySha256,
        signatureHeader: INTEGRATION_SIGNATURE_HEADER,
      },
    });

    try {
      const res = await fetch(input.url, {
        method,
        headers,
        body: rawBody && method !== 'GET' ? rawBody : undefined,
        signal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
      });
      const parsed = await parseBody(res);
      const durationMs = Date.now() - started;
      const result: IntegrationResponse<T> = {
        ok: res.ok,
        status: res.status,
        body: parsed as T,
        headers: responseHeaders(res.headers),
        durationMs,
        bodySha256: signed.bodySha256,
      };

      await this.events.emit({
        type: STUDIO_EVENTS.INTEGRATION_RESPONSE,
        level: res.ok ? 'info' : 'warn',
        conversationId: input.meta?.conversationId,
        runtimeInstanceId: input.meta?.runtimeInstanceId,
        providerCallId: input.meta?.providerCallId,
        payload: {
          name: input.name,
          method,
          url: input.url,
          status: result.status,
          ok: result.ok,
          durationMs,
          body: clipBody(result.body),
          responseHeaders: result.headers,
        },
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      await this.events.emit({
        type: STUDIO_EVENTS.INTEGRATION_ERROR,
        level: 'error',
        conversationId: input.meta?.conversationId,
        runtimeInstanceId: input.meta?.runtimeInstanceId,
        providerCallId: input.meta?.providerCallId,
        payload: {
          name: input.name,
          method,
          url: input.url,
          durationMs,
          error: message,
          bodySha256: signed.bodySha256,
        },
      });
      throw error;
    }
  }
}
