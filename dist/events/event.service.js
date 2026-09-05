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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const conversation_console_1 = require("./conversation-console");
const studio_event_1 = require("./studio-event");
const analytics_tags_1 = require("../analytics/analytics-tags");
/**
 * Framework event shim: emit → console + every registered listener.
 * Persistence is a listener (Postgres by default), not this class.
 */
let EventService = class EventService {
    logger = new common_1.Logger('Vapi Studio');
    listeners;
    constructor(listeners) {
        this.listeners = listeners ?? [];
    }
    log(level, type, payload = {}) {
        (0, conversation_console_1.printConversationConsole)(level, type, payload);
        const line = {
            type,
            ts: new Date().toISOString(),
            ...payload,
        };
        const message = JSON.stringify(line);
        switch (level) {
            case 'debug':
                this.logger.debug(message);
                break;
            case 'warn':
                this.logger.warn(message);
                break;
            case 'error':
                this.logger.error(message);
                break;
            default:
                this.logger.log(message);
        }
    }
    async emit(input) {
        const event = {
            id: input.id ?? (0, crypto_1.randomUUID)(),
            type: input.type,
            ts: input.ts ?? new Date().toISOString(),
            level: input.level ?? 'info',
            conversationId: input.conversationId,
            runtimeInstanceId: input.runtimeInstanceId,
            providerCallId: input.providerCallId,
            payload: input.payload ?? {},
        };
        this.log(event.level, String(event.type), {
            conversationId: event.conversationId,
            runtimeInstanceId: event.runtimeInstanceId,
            providerCallId: event.providerCallId,
            eventId: event.id,
            ...event.payload,
        });
        for (const listener of this.listeners) {
            try {
                await listener.handle(event);
            }
            catch (error) {
                this.logger.error(JSON.stringify({
                    type: 'EVENT_LISTENER_ERROR',
                    listener: listener.constructor?.name,
                    eventType: event.type,
                    eventId: event.id,
                    error: error instanceof Error ? error.message : String(error),
                }));
            }
        }
        return event;
    }
    /** Persist-shaped emit — conversation-scoped event for listeners (Postgres). */
    async persist(conversationId, type, payload = {}) {
        await this.emit({
            type,
            conversationId,
            payload,
            level: 'info',
        });
    }
    /**
     * Funnel / dashboard tag. Stored as type `ANALYTICS_TAG` with `payload.tag`.
     * Funnel charts score via the app’s code catalog (`AnalyticsFunnelDefinition[]`);
     * stamps only need a stable `tag`. Optional legacy `payload.funnels` is still
     * normalized when present.
     */
    async persistAnalyticsTag(conversationId, tag, payload = {}) {
        const clean = tag.trim();
        if (!clean)
            return;
        const rawFunnels = payload.funnels;
        const funnels = (0, analytics_tags_1.normalizeAnalyticsFunnels)(Array.isArray(rawFunnels)
            ? rawFunnels
            : typeof payload.funnel === 'string'
                ? [payload.funnel]
                : undefined);
        const { funnel: _legacy, funnels: _f, ...rest } = payload;
        void _legacy;
        void _f;
        await this.persist(conversationId, 'ANALYTICS_TAG', {
            ...rest,
            tag: clean,
            ...(funnels ? { funnels } : {}),
        });
    }
};
exports.EventService = EventService;
exports.EventService = EventService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(studio_event_1.STUDIO_EVENT_LISTENERS)),
    __metadata("design:paramtypes", [Array])
], EventService);
//# sourceMappingURL=event.service.js.map