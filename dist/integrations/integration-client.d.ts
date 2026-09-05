import { EventService } from '../events/event.service';
export type IntegrationHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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
/**
 * Pre-baked outbound HTTP client: JWT HS256 over the body, `x-signature` header.
 * Every attempt emits INTEGRATION_REQUEST / RESPONSE / ERROR for listeners.
 */
export declare class IntegrationClient {
    private readonly events;
    constructor(events: EventService);
    request<T = unknown>(input: IntegrationRequest): Promise<IntegrationResponse<T>>;
}
//# sourceMappingURL=integration-client.d.ts.map