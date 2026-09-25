# Extending Studio events

Vapi Studio is **event-driven**. Every meaningful turn can emit structured events
on an in-process Node bus. The OSS package does **not** lock you into a single
sink — you attach your own listeners (the same way you attach Postgres).

Guidify companion tools (e.g. analytics) subscribe the same way: listen in-process,
optionally publish to a broker + store. Your app can too.

## Mental model

```text
Node / Supervisor / Forms / Integrations
        │
        ▼
  EventService.emit / persist / persistAnalyticsTag
        │
        ├── console + daily file logs
        ├── onStudioEvent(...)          ← process-wide Node EventEmitter
        └── Nest eventListeners[]       ← DI / StudioEventListener
                │
                ▼ (your code)
        Redis Streams / queue / HTTP / warehouse / CRM
```

**Postgres** = durable conversations. **Event bus** = explainability + side effects.
Neither is Guidify-hosted — both run on your infra.

`EventService.log(...)` is **console/file only** — it does **not** hit `onStudioEvent`.
Use `persist` / `emit` / `persistAnalyticsTag` for anything listeners must see.

## Two listener styles

### 1. `onStudioEvent` (any process code)

```ts
// main.ts — register BEFORE app.listen
import { onStudioEvent, STUDIO_EVENTS } from '@guidify-ai/vapi-studio';

onStudioEvent(async (event) => {
  if (event.type === 'ROUTE_DECISION') {
    // why this node ran
  }
  if (event.type === STUDIO_EVENTS.OUTBOUND_NOTIFICATION) {
    // SMS / outbound channel
  }
  if (event.type === 'ANALYTICS_TAG') {
    // funnel milestone — payload.tag
  }
});
```

### 2. Nest `eventListeners`

```ts
import { Injectable } from '@nestjs/common';
import {
  VapiStudioModule,
  type StudioEvent,
  type StudioEventListener,
} from '@guidify-ai/vapi-studio';

@Injectable()
export class AuditEventListener implements StudioEventListener {
  async handle(event: StudioEvent): Promise<void> {
    // DI-friendly: inject repos, queues, …
  }
}

VapiStudioModule.forRoot({
  // …
  eventListeners: [AuditEventListener],
});
```

Both styles are first-class.

## Sample: Redis Streams broker (like analytics)

Framework does **not** open Redis for you. Your app bridges the bus — same
optional infra pattern as a second Postgres database for an event store.

Compose stub: [`docker-compose.events.stub.yaml`](./docker-compose.events.stub.yaml)

```ts
// src/events/redis-event-bridge.ts — register from main.ts
import { onStudioEvent, type StudioEvent } from '@guidify-ai/vapi-studio';
import Redis from 'ioredis'; // your dependency

const url = process.env.STUDIO_EVENTS_REDIS_URL?.trim();
const stream = process.env.STUDIO_EVENTS_REDIS_STREAM?.trim() || 'studio:events';

export function registerRedisEventBridge(): void {
  if (!url) {
    console.warn('[events] STUDIO_EVENTS_REDIS_URL unset — bus stays in-process only');
    return;
  }
  const redis = new Redis(url);
  onStudioEvent(async (event: StudioEvent) => {
    await redis.xadd(
      stream,
      '*',
      'type', event.type,
      'ts', event.ts,
      'conversationId', event.conversationId ?? '',
      'providerCallId', event.providerCallId ?? '',
      'payload', JSON.stringify(event.payload ?? {}),
    );
  });
}
```

```ts
// main.ts
import { registerRedisEventBridge } from './events/redis-event-bridge';

registerRedisEventBridge();
// … NestFactory.create / listen
```

A separate **consumer** process (analytics, warehouse loader, …) reads the stream
and writes Postgres / ClickHouse / whatever you own. Env presets:

| Variable | Purpose |
| --- | --- |
| `STUDIO_EVENTS_REDIS_URL` | Broker URL (app-owned) |
| `STUDIO_EVENTS_REDIS_STREAM` | Stream name (default `studio:events`) |
| `EVENT_STORE_DATABASE_URL` | Optional durable store for the consumer |

## Sample: emit your own domain events

```ts
// inside a Node
await ctx.events.persist(ctx.conversationId, 'LEAD_QUALIFIED', {
  companyName: ctx.memory.companyName,
});

// funnel milestone (payload.tag only — never payload.funnels)
await ctx.events.persistAnalyticsTag(ctx.conversationId, 'quote_requested');
```

## What events exist?

Canonical catalog: [Events & logging — Event catalog](../reference/events-and-logging.md#event-catalog).

Typed constants exported as `STUDIO_EVENTS` (integrations, outbound, tasks). Many
forensic types are string names (`ROUTE_DECISION`, `FORM_SENDOUT`, …) — filter on
`event.type`.

## Related

- [Events & logging](../reference/events-and-logging.md)
- [Environment variables](../reference/environment-variables.md) · [`.env.example`](../../.env.example)
- [Debugging and observability](../best-practices/debugging-and-observability.md)
- [Data model](../reference/data-model.md)
