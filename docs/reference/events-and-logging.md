# Events & logging

Vapi Studio is an **event-driven** runtime. Structured events explain every turn
and are the extension surface for custom logic — metrics, exporters, CRM sync,
or any tool that listens on the same bus.

Call forensics: every turn should be explainable from daily logs + structured
events (and any durable sink your app attaches).

**How to attach your logic:** [Extending events](../guides/extending-events.md)
(Redis / Nest / custom types). Env presets: [`.env.example`](../../.env.example).

## Event-driven hooks (OSS is open)

| Hook | When to use |
| --- | --- |
| `onStudioEvent(handler)` | Process-wide subscribe — any sink you own |
| Nest `eventListeners` | DI / Nest services implementing `StudioEventListener` |
| `EventService.persist` / `emit` | Emit framework or **app-defined** event types |
| `EventService.persistAnalyticsTag` | Funnel milestone → type `ANALYTICS_TAG` |

The framework does **not** ship a durable event store or dashboard. That is
intentional: attach your own listeners (same ownership model as Postgres).
Guidify AI companion tools integrate through these same hooks.

```ts
import { onStudioEvent, STUDIO_EVENTS } from '@guidify-ai/vapi-studio';

onStudioEvent((event) => {
  /* metrics, Redis, warehouse, … */
});

VapiStudioModule.forRoot({
  eventListeners: [MyNestListener],
});
```

## EventService

| Method | Hits bus? | Purpose |
| --- | --- | --- |
| `emit({ type, conversationId, payload })` | **Yes** | Console + `onStudioEvent` + Nest listeners |
| `persist(conversationId, type, payload)` | **Yes** | Conversation-scoped `emit` (not an automatic Postgres write) |
| `persistAnalyticsTag(conversationId, tag, payload?)` | **Yes** | `ANALYTICS_TAG` with `payload.tag` |
| `log(...)` | **No** | Structured console / daily file only |

## Event catalog

Types below appear on the bus when emitted via `emit` / `persist` /
`persistAnalyticsTag` (or framework helpers that call them). Filter with
`event.type`. App code may emit additional string types.

### Routing & flow

| Event | Answers |
| --- | --- |
| `ROUTE_DECISION` | Why this node ran (`resolvedVia`, intention, boosts) |
| `ROUTE_FAILED` | `before()` refusal, catch, unknown transition |
| `ROUTE_FALLBACK_UNKNOWN` | Fell through to unknown handling |
| `UNKNOWN_ORIGIN_CONSUME` | Unknown portal accepted restatement vs origin listen |
| `CONDITION_TRANSITION` | YAML/code force jump |
| `CONDITION_TRANSITION_MISSED` | Condition jump did not apply |
| `FLOW_CONTINUE` | `continueTo` target + reason |
| `WORKFLOW_HANDOFF` | Squad module switch |

### Conversation lifecycle

| Event | Answers |
| --- | --- |
| `BOOTSTRAP` / `FINALIZE` | Runtime create / tear-down |
| `CONVERSATION_BEFORE_EACH` / `CONVERSATION_AFTER_EACH` | Entry hooks |
| `CONVERSATION_ENTRY_POINT` | Entry seeding |
| `CONVERSATION_RESUMED` | Resume after pause / form |
| `CONVERSATION_LIMIT_EXCEEDED` | Turn or wall-clock cap → fail-closed `endCall` |
| `DISASTER_RESTORED` | Disaster recovery restore |

### Brain

| Event | Answers |
| --- | --- |
| `BRAIN_SCAN_START` / `BRAIN_SCAN_RESULT` | Intention / extract scan |
| `BRAIN_JUDGE_START` / `BRAIN_JUDGE_RESULT` | Judge pass |
| `BRAIN_CLARIFY_START` / `BRAIN_CLARIFY_RESULT` | Clarify pass |
| `BRAIN_USAGE` / `BRAIN_COST_SUMMARY` | Tokens / cost (live adapters) |
| `BRAIN_SERVICE` | Adapter selection / errors |

### Forms & outbound

| Event | Answers |
| --- | --- |
| `FORM_EXPOSE` / `FORM_SENDOUT` / `FORM_RESEND` / `FORM_RESENT` | Form lane |
| `FORM_LINK_READY` / `FORM_DELIVERED` / `FORM_DELIVER_TIMEOUT` | Delivery |
| `FORM_SUBMITTED` / `FORM_FILLOUT_TIMEOUT` | User fill |
| `FORM_CHANNEL_UNAVAILABLE` / `FORM_DISPOSE_ADAPTER` | Channel wiring |
| `OUTBOUND_NOTIFICATION` | SMS (Twilio) / future channels — `channel`, `status`, `to`, `sid` |
| `OUTBOUND_NOTIFICATION_ERROR` | Outbound send failed |

Typed aliases: `STUDIO_EVENTS.OUTBOUND_NOTIFICATION` (+ `_ERROR`).

### Integrations & tasks

| Event | Constant | Answers |
| --- | --- | --- |
| `INTEGRATION_REQUEST` / `RESPONSE` / `ERROR` | `STUDIO_EVENTS.INTEGRATION_*` | Outbound HTTP + JWT |
| `TASK_ENQUEUED` / `STARTED` / `COMPLETED` / `FAILED` / `DEDUPED` / `AWAITED` | `STUDIO_EVENTS.TASK_*` | Studio Task Queue |

### Analytics

| Event | Answers |
| --- | --- |
| `ANALYTICS_TAG` | Funnel milestone — **`payload.tag` only** (never `payload.funnels`) |

### Ingress / speech (often app-emitted or adapter path)

| Event | Answers |
| --- | --- |
| `WEBHOOK_RECEIVED` / `ASSISTANT_REQUEST` | Vapi webhook |
| `CUSTOM_LLM_*` | Custom LLM turn queue / abort / errors |
| `SAY` | Spoken text |
| `EVENT_BUS_ERROR` / `EVENT_LISTENER_ERROR` | Listener failures |

Full doctrine: [Debugging and observability](../best-practices/debugging-and-observability.md).

## Console & daily files

| Env | Effect |
| --- | --- |
| `STUDIO_CONSOLE_DEBUG` | Pretty colored turn forensics |
| `STUDIO_CONSOLE_DEBUG_ALL` | Verbose (all event types) |
| `LOG_DIR` / `LOG_DAYS` / `STUDIO_FILE_LOG` | Daily `logs/dailyYYYYMMDD.log` |

## Broker + database (app-owned)

Treat Redis (or another broker) like Postgres: optional compose service, env URL,
your consumer. Framework stays in-process. See
[Extending events](../guides/extending-events.md) and
[`docker-compose.events.stub.yaml`](../guides/docker-compose.events.stub.yaml).
