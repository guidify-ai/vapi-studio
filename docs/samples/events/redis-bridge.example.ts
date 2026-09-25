/**
 * EXAMPLE — copy into your Nest app (e.g. src/events/redis-event-bridge.ts).
 * Not executed by the framework package.
 *
 * Bridges onStudioEvent → Redis Streams so a separate consumer (analytics,
 * warehouse, …) can read the same way Roofr → ecosystem-analytics does.
 *
 * Requires: yarn add ioredis
 * Env: STUDIO_EVENTS_REDIS_URL, STUDIO_EVENTS_REDIS_STREAM (optional)
 */
import { onStudioEvent, type StudioEvent } from '@guidify-ai/vapi-studio';

// import Redis from 'ioredis';

export function registerRedisEventBridge(): void {
  const url = process.env.STUDIO_EVENTS_REDIS_URL?.trim();
  const stream =
    process.env.STUDIO_EVENTS_REDIS_STREAM?.trim() || 'studio:events';
  if (!url) {
    // eslint-disable-next-line no-console
    console.warn(
      '[events] STUDIO_EVENTS_REDIS_URL unset — Studio events stay in-process only',
    );
    return;
  }

  // const redis = new Redis(url);
  onStudioEvent(async (event: StudioEvent) => {
    // await redis.xadd(
    //   stream,
    //   '*',
    //   'id', event.id,
    //   'type', event.type,
    //   'ts', event.ts,
    //   'level', event.level,
    //   'conversationId', event.conversationId ?? '',
    //   'runtimeInstanceId', event.runtimeInstanceId ?? '',
    //   'providerCallId', event.providerCallId ?? '',
    //   'payload', JSON.stringify(event.payload ?? {}),
    // );
    void event;
    void stream;
  });
}
