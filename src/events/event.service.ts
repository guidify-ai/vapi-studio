import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  printConversationConsole,
  type StudioLogLevel,
} from './conversation-console';
import {
  STUDIO_EVENT_LISTENERS,
  type StudioEvent,
  type StudioEventInput,
  type StudioEventListener,
} from './studio-event';
import { normalizeAnalyticsFunnels } from '../analytics/analytics-tags';

export type { StudioLogLevel } from './conversation-console';

/**
 * Framework event shim: emit → console + every registered listener.
 * Persistence is a listener (Postgres by default), not this class.
 */
@Injectable()
export class EventService {
  private readonly logger: Logger = new Logger('Vapi Studio');
  private readonly listeners: StudioEventListener[];

  public constructor(
    @Optional()
    @Inject(STUDIO_EVENT_LISTENERS)
    listeners?: StudioEventListener[],
  ) {
    this.listeners = listeners ?? [];
  }

  public log(
    level: StudioLogLevel,
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

  public async emit(input: StudioEventInput): Promise<StudioEvent> {
    const event: StudioEvent = {
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
  public async persist(
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

  /**
   * Funnel / dashboard tag. Stored as type `ANALYTICS_TAG` with `payload.tag`.
   * Funnel charts score via the app’s code catalog (`AnalyticsFunnelDefinition[]`);
   * stamps only need a stable `tag`. Optional legacy `payload.funnels` is still
   * normalized when present.
   */
  public async persistAnalyticsTag(
    conversationId: string,
    tag: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    const clean = tag.trim();
    if (!clean) return;
    const rawFunnels = payload.funnels;
    const funnels = normalizeAnalyticsFunnels(
      Array.isArray(rawFunnels)
        ? (rawFunnels as string[])
        : typeof payload.funnel === 'string'
          ? [payload.funnel]
          : undefined,
    );
    const { funnel: _legacy, funnels: _f, ...rest } = payload;
    void _legacy;
    void _f;
    await this.persist(conversationId, 'ANALYTICS_TAG', {
      ...rest,
      tag: clean,
      ...(funnels ? { funnels } : {}),
    });
  }
}
