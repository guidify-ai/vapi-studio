# Events & logging

Call forensics — every turn should be explainable from logs + `conversation_events`.

## EventService

| Method | Purpose |
| --- | --- |
| `emit({ type, conversationId, payload })` | In-process listeners + optional persist |
| `persist(conversationId, type, payload)` | Postgres `conversation_events` |
| `log(...)` | Structured console / daily file |

Apps add `eventListeners` in `VapiStudioModule.forRoot`.

## Console driver

| Env | Effect |
| --- | --- |
| `RA9_CONSOLE_DEBUG` | Pretty colored turn forensics |
| `RA9_CONSOLE_DEBUG_ALL` | Verbose (all event types) |

Tags include **FORM**, **ROUTE**, **BRAIN**, **INTEGRATION**.

## Daily file logs

| Env | Default |
| --- | --- |
| `LOG_DIR` | `logs/` |
| `LOG_DAYS` | `14` |
| `RA9_FILE_LOG` | on |

Files: `logs/dailyYYYYMMDD.log`

## Key forensic events

| Event | Answers |
| --- | --- |
| `ROUTE_DECISION` | Why this node ran (`resolvedVia`, intention, boosts) |
| `ROUTE_FAILED` | `before()` refusal, catch, unknown transition |
| `CONDITION_TRANSITION` | YAML/code force jump |
| `FLOW_CONTINUE` | `continueTo` target + reason |
| `FORM_SENDOUT` / `FORM_RESEND` | Which form lane, delivery branch |
| `FORM_SUBMITTED` | Form keys received |
| `WORKFLOW_HANDOFF` | Squad module switch |
| `INTEGRATION_*` | Outbound HTTP + JWT |
| `BRAIN_COST_SUMMARY` | Token/cost estimate (ChatGPT path) |

Full doctrine: [Debugging and observability](../best-practices/debugging-and-observability.md)

## App events

Applications may persist custom events via `EventService.persist` — name and document them in the app repo.

## Related

- [Data model](./data-model.md)
