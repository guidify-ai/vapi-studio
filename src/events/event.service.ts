import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  printConversationConsole,
  type Ra9LogLevel,
} from './conversation-console';
import {
  RA9_EVENT_LISTENERS,
  type Ra9Event,
  type Ra9EventInput,
  type Ra9EventListener,
} from './ra9-event';

export type { Ra9LogLevel } from './conversation-console';

/**
 * Framework event shim: emit → console + every registered listener.
 * Persistence is a listener (Postgres by default), not this class.
 */
@Injectable()
export class EventService {
  private readonly logger = new Logger('RA9');
  private readonly listeners: Ra9EventListener[];

  constructor(
    @Optional()
    @Inject(RA9_EVENT_LISTENERS)
    listeners?: Ra9EventListener[],
  ) {
    this.listeners = listeners ?? [];
  }

  log(
    level: Ra9LogLevel,
    type: string,
    payload: Record<string, unknown> = {},
  ): void {
    printConversationConsole(level, type, payload);

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

  async emit(input: Ra9EventInput): Promise<Ra9Event> {
    const event: Ra9Event = {
      id: input.id ?? randomUUID(),
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
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            type: 'EVENT_LISTENER_ERROR',
            listener: listener.constructor?.name,
            eventType: event.type,
            eventId: event.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    return event;
  }

  /** Persist-shaped emit — conversation-scoped event for listeners (Postgres). */
  async persist(
    conversationId: string,
    type: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.emit({
      type,
      conversationId,
      payload,
      level: 'info',
    });
  }
}
