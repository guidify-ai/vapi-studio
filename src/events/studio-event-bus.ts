/**
 * In-process Studio event bus — Node EventEmitter.
 *
 * `EventService.emit` fires {@link STUDIO_EVENT_BUS_CHANNEL} with a {@link StudioEvent}.
 * Apps may {@link onStudioEvent} and forward elsewhere if they operate their own sinks.
 */

import { EventEmitter } from 'events';
import type { StudioEvent } from './studio-event';

/** Channel name passed to `studioEventBus.on(STUDIO_EVENT_BUS_CHANNEL, handler)`. */
export const STUDIO_EVENT_BUS_CHANNEL = 'studio.event';

const bus: EventEmitter = new EventEmitter();
bus.setMaxListeners(50);

/** Shared process-local bus. Do not replace. */
export function studioEventBus(): EventEmitter {
  return bus;
}

export type StudioEventBusHandler = (event: StudioEvent) => void | Promise<void>;

/** Subscribe without Nest DI. Returns an unsubscribe function. */
export function onStudioEvent(handler: StudioEventBusHandler): () => void {
  const wrapped = (event: StudioEvent): void => {
    void Promise.resolve(handler(event)).catch(() => {
      /* subscriber errors must not break emit */
    });
  };
  bus.on(STUDIO_EVENT_BUS_CHANNEL, wrapped);
  return () => {
    bus.off(STUDIO_EVENT_BUS_CHANNEL, wrapped);
  };
}

export function emitStudioEventBus(event: StudioEvent): void {
  bus.emit(STUDIO_EVENT_BUS_CHANNEL, event);
}
