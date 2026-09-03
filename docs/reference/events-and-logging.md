# Events & logging

Call forensics — every turn should be explainable from logs + `conversation_events`.

## EventService

| Method | Purpose |
| --- | --- |
| `emit({ type, conversationId, payload })` | In-process listeners + optional persist |
| `persist(conversationId, type, payload)` | Postgres `conversation_events` |
| `persistAnalyticsTag(conversationId, tag, payload?)` | Funnel milestone — type `ANALYTICS_TAG`, `payload.tag` |
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
| `UNKNOWN_ORIGIN_CONSUME` | Unknown portal accepted the restatement against the origin listen (`unknown_origin_consume`) |
| `ROUTE_FAILED` | `before()` refusal, catch, unknown transition |
| `CONDITION_TRANSITION` | YAML/code force jump |
| `FLOW_CONTINUE` | `continueTo` target + reason |
| `FORM_SENDOUT` / `FORM_RESEND` | Which form lane, delivery branch |
| `FORM_SUBMITTED` | Form keys received |
| `WORKFLOW_HANDOFF` | Squad module switch |
| `INTEGRATION_*` | Outbound HTTP + JWT |
| `BRAIN_COST_SUMMARY` | Token/cost estimate (ChatGPT path) |

Full doctrine: [Debugging and observability](../best-practices/debugging-and-observability.md)

## Analytics tags & funnels

Conversations are funnels. Stamp milestones with `persistAnalyticsTag` (or bind funnel steps to existing event types so history still scores).

| Piece | Role |
| --- | --- |
| `ANALYTICS_TAG` | Durable tag event (`payload.tag`, optional `funnel` / `label`) |
| Funnel catalog (app) | Ordered steps → `eventTypes[]` and/or `tags[]` |
| Aggregation | Distinct conversations per step / top tags, scoped by `conversations.project_id` |

Operator UI (example): `/analytics` — conversion bars + top tags for the project.

## App events

Applications may persist custom events via `EventService.persist` — name and document them in the app repo.

| Event | Payload | When |
| --- | --- | --- |
| `CONVERSATION_PATH` | `signature`, `branchLabel`, `nodes[]`, `portalHits` | App teardown — actual node path |
| `CALL_OUTCOME` | `outcome` (`success` \| `failure` \| `unknown`), `reasoning[]`, `confidence`, `source` | App teardown — Brain judge triage |

## Related

- [Data model](./data-model.md)
