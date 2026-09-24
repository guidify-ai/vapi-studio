/**
 * Framework events — produce here; subscribers decide what to do.
 *
 * Console + in-process Node EventEmitter (`onStudioEvent`) + optional Nest
 * `eventListeners` (e.g. in-memory Studio UI buffer). Durable sinks are
 * application-owned — not part of this package.
 */

import type { StudioLogLevel } from './conversation-console';

export const STUDIO_EVENT_LISTENERS = Symbol('STUDIO_EVENT_LISTENERS');

export const STUDIO_EVENTS = {
  INTEGRATION_REQUEST: 'INTEGRATION_REQUEST',
  INTEGRATION_RESPONSE: 'INTEGRATION_RESPONSE',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',
  /** Outbound SMS / push / email — emit for app-owned sinks / logs. */
  OUTBOUND_NOTIFICATION: 'OUTBOUND_NOTIFICATION',
  OUTBOUND_NOTIFICATION_ERROR: 'OUTBOUND_NOTIFICATION_ERROR',
  /** Studio Task Queue lifecycle (see StudioTaskQueue). */
  TASK_ENQUEUED: 'TASK_ENQUEUED',
  TASK_STARTED: 'TASK_STARTED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_FAILED: 'TASK_FAILED',
  TASK_DEDUPED: 'TASK_DEDUPED',
  TASK_AWAITED: 'TASK_AWAITED',
} as const;

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
