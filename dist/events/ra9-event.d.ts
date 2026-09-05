/**
 * Framework events — produce here; listeners decide what to do.
 * Default listener writes to PostgreSQL. Apps (e.g. roofr-poc) may add more.
 */
import type { Ra9LogLevel } from './conversation-console';
export declare const RA9_EVENT_LISTENERS: unique symbol;
export declare const RA9_EVENTS: {
    readonly INTEGRATION_REQUEST: "INTEGRATION_REQUEST";
    readonly INTEGRATION_RESPONSE: "INTEGRATION_RESPONSE";
    readonly INTEGRATION_ERROR: "INTEGRATION_ERROR";
    /** Outbound SMS / push / email — durable via PostgresEventListener. */
    readonly OUTBOUND_NOTIFICATION: "OUTBOUND_NOTIFICATION";
    readonly OUTBOUND_NOTIFICATION_ERROR: "OUTBOUND_NOTIFICATION_ERROR";
};
export type Ra9EventType = (typeof RA9_EVENTS)[keyof typeof RA9_EVENTS] | string;
export interface Ra9Event {
    id: string;
    type: Ra9EventType;
    ts: string;
    level: Ra9LogLevel;
    conversationId?: string;
    runtimeInstanceId?: string;
    providerCallId?: string;
    payload: Record<string, unknown>;
}
export type Ra9EventInput = Omit<Ra9Event, 'id' | 'ts' | 'level'> & {
    id?: string;
    ts?: string;
    level?: Ra9LogLevel;
};
export interface Ra9EventListener {
    handle(event: Ra9Event): void | Promise<void>;
}
//# sourceMappingURL=ra9-event.d.ts.map