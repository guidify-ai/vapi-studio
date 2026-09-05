import { type StudioLogLevel } from './conversation-console';
import { type StudioEvent, type StudioEventInput, type StudioEventListener } from './studio-event';
export type { StudioLogLevel } from './conversation-console';
/**
 * Framework event shim: emit → console + every registered listener.
 * Persistence is a listener (Postgres by default), not this class.
 */
export declare class EventService {
    private readonly logger;
    private readonly listeners;
    constructor(listeners?: StudioEventListener[]);
    log(level: StudioLogLevel, type: string, payload?: Record<string, unknown>): void;
    emit(input: StudioEventInput): Promise<StudioEvent>;
    /** Persist-shaped emit — conversation-scoped event for listeners (Postgres). */
    persist(conversationId: string, type: string, payload?: Record<string, unknown>): Promise<void>;
    /**
     * Funnel / dashboard tag. Stored as type `ANALYTICS_TAG` with `payload.tag`.
     * Funnel charts score via the app’s code catalog (`AnalyticsFunnelDefinition[]`);
     * stamps only need a stable `tag`. Optional legacy `payload.funnels` is still
     * normalized when present.
     */
    persistAnalyticsTag(conversationId: string, tag: string, payload?: Record<string, unknown>): Promise<void>;
}
//# sourceMappingURL=event.service.d.ts.map