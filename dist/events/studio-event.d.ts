/**
 * Framework events — produce here; listeners decide what to do.
 * Default listener writes to PostgreSQL. Apps (e.g. roofr-poc) may add more.
 */
import type { StudioLogLevel } from './conversation-console';
export declare const STUDIO_EVENT_LISTENERS: unique symbol;
export declare const STUDIO_EVENTS: {
    readonly INTEGRATION_REQUEST: "INTEGRATION_REQUEST";
    readonly INTEGRATION_RESPONSE: "INTEGRATION_RESPONSE";
    readonly INTEGRATION_ERROR: "INTEGRATION_ERROR";
    /** Outbound SMS / push / email — durable via PostgresEventListener. */
    readonly OUTBOUND_NOTIFICATION: "OUTBOUND_NOTIFICATION";
    readonly OUTBOUND_NOTIFICATION_ERROR: "OUTBOUND_NOTIFICATION_ERROR";
};
export type StudioEventType = (typeof STUDIO_EVENTS)[keyof typeof STUDIO_EVENTS] | string;
export interface StudioEvent {
    id: string;
    type: StudioEventType;
    ts: string;
    level: StudioLogLevel;
    conversationId?: string;
    runtimeInstanceId?: string;
    providerCallId?: string;
    payload: Record<string, unknown>;
}
export type StudioEventInput = Omit<StudioEvent, 'id' | 'ts' | 'level'> & {
    id?: string;
    ts?: string;
    level?: StudioLogLevel;
};
export interface StudioEventListener {
    handle(event: StudioEvent): void | Promise<void>;
}
//# sourceMappingURL=studio-event.d.ts.map