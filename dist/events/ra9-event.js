"use strict";
/**
 * Framework events — produce here; listeners decide what to do.
 * Default listener writes to PostgreSQL. Apps (e.g. roofr-poc) may add more.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RA9_EVENTS = exports.RA9_EVENT_LISTENERS = void 0;
exports.RA9_EVENT_LISTENERS = Symbol('RA9_EVENT_LISTENERS');
exports.RA9_EVENTS = {
    INTEGRATION_REQUEST: 'INTEGRATION_REQUEST',
    INTEGRATION_RESPONSE: 'INTEGRATION_RESPONSE',
    INTEGRATION_ERROR: 'INTEGRATION_ERROR',
    /** Outbound SMS / push / email — durable via PostgresEventListener. */
    OUTBOUND_NOTIFICATION: 'OUTBOUND_NOTIFICATION',
    OUTBOUND_NOTIFICATION_ERROR: 'OUTBOUND_NOTIFICATION_ERROR',
};
//# sourceMappingURL=ra9-event.js.map