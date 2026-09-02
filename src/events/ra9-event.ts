/**
 * Framework events — produce here; listeners decide what to do.
 * Default listener writes to PostgreSQL. Apps (e.g. roofr-poc) may add more.
 */

import type { Ra9LogLevel } from './conversation-console';

export const RA9_EVENT_LISTENERS = Symbol('RA9_EVENT_LISTENERS');

export const RA9_EVENTS = {
  INTEGRATION_REQUEST: 'INTEGRATION_REQUEST',
  INTEGRATION_RESPONSE: 'INTEGRATION_RESPONSE',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',
} as const;

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
