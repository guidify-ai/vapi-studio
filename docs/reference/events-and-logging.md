# Events & logging

Vapi Studio is an **event-driven** runtime. Structured events explain every turn
and are the extension surface for custom logic — metrics, exporters, CRM sync,
or any tool that listens on the same bus.

Call forensics: every turn should be explainable from daily logs + structured
events (and any durable sink your app attaches).

## Event-driven hooks (OSS is open)

| Hook | When to use |
| --- | --- |
| `onStudioEvent(handler)` | Process-wide subscribe — any sink you own |
| Nest `eventListeners` | DI / Nest services implementing `StudioEventListener` |
| `EventService.persist` / `emit` | Emit framework or **app-defined** event types |

The framework does **not** ship a durable event store or dashboard. That is
intentional: attach your own listeners. Guidify AI companion tools integrate
through these same hooks; your projects are not limited by the OSS package.

Full guide: [Extending events](../guides/extending-events.md).

## EventService

| Method | Purpose |
| --- | --- |
| `emit({ type, conversationId, payload })` | Console + **Node EventEmitter** (`onStudioEvent`) + Nest `StudioEventListener`s |
| `persist(conversationId, type, payload)` | Conversation-scoped `emit` (not an automatic Postgres write) |
| `persistAnalyticsTag(conversationId, tag, payload?)` | Funnel milestone — type `ANALYTICS_TAG`, `payload.tag` |
| `log(...)` | Structured console / daily file only (no listeners / bus) |

```ts
import { onStudioEvent } from '@guidify-ai/vapi-studio';

onStudioEvent((event) => {
  /* your listener — metrics, queue, warehouse, … */
});

VapiStudioModule.forRoot({
  eventListeners: [StudioEventBuffer], // Nest DI listeners
});
```

## Console driver

| Env | Effect |
| --- | --- |
| `STUDIO_CONSOLE_DEBUG` | Pretty colored turn forensics |
| `STUDIO_CONSOLE_DEBUG_ALL` | Verbose (all event types) |

Tags include **FORM**, **ROUTE**, **BRAIN**, **INTEGRATION**, **NOTIFY**.

## Daily file logs

| Env | Default |
| --- | --- |
| `LOG_DIR` | `logs/` |
| `LOG_DAYS` | `14` |
| `STUDIO_FILE_LOG` | on |

Files: `logs/dailyYYYYMMDD.log`

## Key forensic events

| Event | Answers |
| --- | --- |
| `ROUTE_DECISION` | Why this node ran (`resolvedVia`, intention, boosts) |
| `UNKNOWN_ORIGIN_CONSUME` | Unknown portal accepted the restatement against the origin listen (`unknown_origin_consume`) |
| `ROUTE_FAILED` | `before()` refusal, catch, unknown transition |
| `CONDITION_TRANSITION` | YAML/code force jump |
| `FLOW_CONTINUE` | `continueTo` target + reason |
| `FORM_SENDOUT` / `FORM_RESEND` | Which form lane, delivery branch |
| `FORM_SUBMITTED` | Form keys received |
| `WORKFLOW_HANDOFF` | Squad module switch |
| `INTEGRATION_*` | Outbound HTTP + JWT |
| `OUTBOUND_NOTIFICATION` | SMS (Twilio) / future channels — `channel`, `status`, `to`, `sid` |
| `OUTBOUND_NOTIFICATION_ERROR` | Outbound send failed before/during provider call |
| `BRAIN_COST_SUMMARY` | Token/cost estimate (ChatGPT path) |
| `CONVERSATION_LIMIT_EXCEEDED` | Turn or wall-clock cap hit → fail-closed `endCall` |

Full doctrine: [Debugging and observability](../best-practices/debugging-and-observability.md)

## Analytics tags

Stamp milestones with `persistAnalyticsTag` / `stampAnalyticsTag`:

| Piece | Role |
| --- | --- |
| `ANALYTICS_TAG` | Milestone (`payload.tag`) |
| App tag catalog | Stable `snake_case` ids used by your tooling |

Do **not** put funnel membership on the event (`payload.funnels`).

## App events

Applications may emit custom events via `EventService.persist` — name and
document them in the app repo.
