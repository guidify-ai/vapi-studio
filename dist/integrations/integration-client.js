"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationClient = void 0;
const common_1 = require("@nestjs/common");
const event_service_1 = require("../events/event.service");
const studio_event_1 = require("../events/studio-event");
const jwt_hmac_1 = require("./jwt-hmac");
const MAX_STORED_BODY_CHARS = 8_192;
function clipBody(value) {
    if (value == null)
        return value;
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (raw.length <= MAX_STORED_BODY_CHARS)
        return value;
    return `${raw.slice(0, MAX_STORED_BODY_CHARS)}…`;
}
function responseHeaders(headers) {
    const out = {};
    headers.forEach((value, key) => {
        out[key] = value;
    });
    return out;
}
async function parseBody(res) {
    const text = await res.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
/**
 * Pre-baked outbound HTTP client: JWT HS256 over the body, `x-signature` header.
 * Every attempt emits INTEGRATION_REQUEST / RESPONSE / ERROR for listeners.
 */
let IntegrationClient = class IntegrationClient {
    events;
    constructor(events) {
        this.events = events;
    }
    async request(input) {
        const method = (input.method ?? 'POST').toUpperCase();
        const rawBody = method === 'GET' ? '' : (0, jwt_hmac_1.canonicalRequestBody)(input.body);
        const secret = (0, jwt_hmac_1.readSecretEnv)(input.secretEnvKey);
        const signed = (0, jwt_hmac_1.signIntegrationRequest)({
            secret,
            method,
            url: input.url,
            body: rawBody,
            ttlSeconds: input.ttlSeconds,
        });
        const headers = {
            accept: 'application/json',
            ...(input.headers ?? {}),
            [jwt_hmac_1.INTEGRATION_SIGNATURE_HEADER]: signed.token,
        };
        if (rawBody && !headers['content-type']) {
            headers['content-type'] = 'application/json';
        }
        const started = Date.now();
        await this.events.emit({
            type: studio_event_1.STUDIO_EVENTS.INTEGRATION_REQUEST,
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
                signatureHeader: jwt_hmac_1.INTEGRATION_SIGNATURE_HEADER,
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
            const result = {
                ok: res.ok,
                status: res.status,
                body: parsed,
                headers: responseHeaders(res.headers),
                durationMs,
                bodySha256: signed.bodySha256,
            };
            await this.events.emit({
                type: studio_event_1.STUDIO_EVENTS.INTEGRATION_RESPONSE,
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
        }
        catch (error) {
            const durationMs = Date.now() - started;
            const message = error instanceof Error ? error.message : String(error);
            await this.events.emit({
                type: studio_event_1.STUDIO_EVENTS.INTEGRATION_ERROR,
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
};
exports.IntegrationClient = IntegrationClient;
exports.IntegrationClient = IntegrationClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [event_service_1.EventService])
], IntegrationClient);
//# sourceMappingURL=integration-client.js.map