# Extending Studio events

Vapi Studio is **event-driven**. Every meaningful turn of a call emits structured
events on an in-process Node bus. The OSS package does **not** lock you into a
single sink — you attach your own listeners and implement whatever logic you need.

Guidify AI builds its own companion tools the same way: they subscribe to these
hooks. Your app can too.

## Two listener styles

### 1. `onStudioEvent` (any process code)

```ts
import { onStudioEvent } from '@guidify-ai/vapi-studio';

onStudioEvent(async (event) => {
  // metrics, audit trail, queue publish, CRM sync, …
});
```

Register early (e.g. from `main.ts` before `app.listen`). Handlers run for every
`EventService.emit` / `persist` / `persistAnalyticsTag` in this process.

### 2. Nest `eventListeners`

```ts
VapiStudioModule.forRoot({
  eventListeners: [MyStudioEventListener],
});
```

Implement `StudioEventListener.handle(event)`. Use this when you want DI,
scoped services, or to share the Nest module graph (e.g. Studio UI’s in-memory
buffer).

Both styles are first-class. OSS does not require a broker, cloud account, or
Guidify-hosted service to add behavior.

## What the framework emits

`EventService.emit` / `persist` / `persistAnalyticsTag` always:

1. Console / daily file logs  
2. Node `EventEmitter` (`onStudioEvent`)  
3. Nest `eventListeners` (when registered)

The framework does **not** ship a durable event database or remote event API.
Durability, fan-out, and product UIs are application-owned — attach them to the
hooks above.

Stamp funnel milestones with `persistAnalyticsTag` (type `ANALYTICS_TAG`,
`payload.tag`). Do **not** put funnel membership on the event (`payload.funnels`).

## Patterns apps use

| Pattern | How |
| --- | --- |
| In-process side effects | Nest `eventListeners` or `onStudioEvent` |
| Export to your infra | `onStudioEvent` → Redis / queue / HTTP / warehouse |
| Optional private modules | `src/shadows/register.ts` try/require private files (sample pattern) |
| Custom domain events | `ctx.events.persist(conversationId, 'MY_APP_EVENT', { … })` |
| Task lifecycle | `ctx.tasks.dispatch` / `require` → `TASK_ENQUEUED` / `STARTED` / `COMPLETED` / `FAILED` / `DEDUPED` / `AWAITED` |

Without any listener beyond console + daily logs, the app still runs — hooks are
additive, not mandatory.

Local Guidify lab uses a **shared** Redis + Postgres (sibling `guidify-lab` infra compose) while app containers stay on separate Docker networks and connect via `host.docker.internal`.

## Operator UI

Studio SPA routes: `/flow`, `/conversations`. Conversation forensics there are
chat / memory / path. Richer dashboards belong in tools you (or Guidify) build
on the same event hooks.

## Related

- [Events & logging](../reference/events-and-logging.md)
- [Data model](../reference/data-model.md)
- [Debugging and observability](../best-practices/debugging-and-observability.md)
