import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderIngressEntity } from './provider-ingress.entity';

const REDACT_HEADER_KEYS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);

function sanitizeHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!headers) {
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (REDACT_HEADER_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = value;
    }
  }
  return out;
}

@Injectable()
export class ProviderIngressRepository {
  public constructor(
    @InjectRepository(ProviderIngressEntity)
    private readonly rows: Repository<ProviderIngressEntity>,
  ) {}

  public async record(input: {
    projectId?: string | null;
    channel?: string;
    kind: string;
    providerCallId?: string | null;
    messageType?: string | null;
    method?: string;
    path: string;
    headers?: Record<string, unknown>;
    body?: Record<string, unknown>;
    responseStatus?: number | null;
    responseBody?: Record<string, unknown> | null;
  }): Promise<ProviderIngressEntity> {
    const row = this.rows.create({
      projectId: input.projectId ?? null,
      channel: input.channel ?? 'vapi',
      kind: input.kind,
      providerCallId: input.providerCallId ?? null,
      messageType: input.messageType ?? null,
      method: input.method ?? 'POST',
      path: input.path,
      headers: sanitizeHeaders(input.headers),
      body: input.body ?? {},
      responseStatus: input.responseStatus ?? null,
      responseBody: input.responseBody ?? null,
    });
    return this.rows.save(row);
  }

  public async setResponse(
    id: string,
    responseStatus: number,
    responseBody?: Record<string, unknown> | null,
  ): Promise<void> {
    await this.rows.update(
      { id },
      {
        responseStatus,
        responseBody: (responseBody ?? null) as never,
      },
    );
  }
}
