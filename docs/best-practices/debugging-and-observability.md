# Debugging and observability

**Hard rule:** logs and persisted events must always be enough to answer any question about what happened on a call — without replaying the call or guessing.

**Operator-only:** Event types (`ROUTE_DECISION`, `CONDITION_TRANSITION`, …), node ids, and memory keys exist for **you** and Studio UIs — the bot must never mention them to the caller. See [conversation-design.md](./conversation-design.md) § Human-like UX.

If you change routing, listens, extracts, identity, or speech and cannot reconstruct the turn from `conversation_events` + daily file logs alone, the change is incomplete: add structured fields in the **same** work.

## Where forensics live

| Source | What it answers |
| --- | --- |
| `{LOG_DIR}/dailyYYYYMMDD.log` + console | Full turn stream: user text, condition transitions, Brain/listen resolve, `ROUTE_DECISION`, `NODE_*`, `SAY`, memory diffs |
| `conversation_events` (Postgres via `emit`/`persist`) | Durable subset: lifecycle, `CONDITION_TRANSITION`, `FORM_SENDOUT`, `ROUTE_DECISION` / `ROUTE_FAILED`, `FLOW_CONTINUE`, app events (`PHONE_DIGITS_EVAL`, `FORM_LINK_READY`, caller CRM), funnel `ANALYTICS_TAG` |
| `provider_ingress` | Raw Vapi webhook / Custom LLM bodies (ASR archaeology) |
| `conversations.runtime_state` / `final_state` | Full memory checkpoint |

Turn detail that only used `EventService.log` historically is **not** in Studio’s emit buffer. Prefer `persist` (or `emit`) for any decision you would need to debug after the container restarts.

## Must-answer questions (checklist)

Before merging conversation/routing work, confirm logs can answer:

1. **What did the user say?** (`userText` on turn + `ROUTE_DECISION`)
2. **How was the intention chosen?** (`listen_resolve` vs Brain scores + reasons, or `CONDITION_TRANSITION` / `resolvedVia: condition_force|condition_boost` — console **FORCE** / **WHEN**)
3. **Why did this Node win?** (`ROUTE_DECISION`: walk order, listen boosts, `rejected[]` with `before_false` / `missing`, winner)
4. **Which form sendout lane?** (`FORM_SENDOUT`: conversation `branch` + adapter `deliveryBranch` — console **FORM** — before ACK/submit). Resends show as `FORM_RESEND` / `FORM_RESENT` (same exposeId).
5. **What did the Node do?** (`NODE_AFTER.resultDetail`: say text, `continueTo` target+reason, listen/extract keys)
6. **What memory flags mattered?** MEMORY diffs include `introSpoken`, consent, phone confirm, `formSendoutBranch`, etc. (do not strip conversation-critical booleans)
7. **Constrained field outcomes?** e.g. `PHONE_DIGITS_EVAL`: raw ASR, normalized digits, count, accepted path

## App-owned events

Apps should `ctx.events.persist(conversationId, TYPE, { … })` for domain decisions that framework routing does not cover (phone digit eval, form mock wait, CRM hydrate). Include `runtimeInstanceId`, `providerCallId`, `turnNumber`, and the raw + normalized inputs — never only the spoken apology text.

For **admin funnel stats**, define an `AnalyticsFunnelDefinition[]` catalog in code (ordered steps → `tags[]` and/or `eventTypes[]`). Stamp milestones with `persistAnalyticsTag` / `stampAnalyticsTag` using stable `snake_case` tags — **catalog membership**, not `payload.funnels`. Charts score via `countConversationsMatchingStep({ tags, eventTypes })`. One project = one analytics page with outcomes, funnel charts, and top tags. Product apps usually model outcome paths (e.g. appointment only / estimate only / both), not internal graph stages.

Ended calls should persist **`CONVERSATION_PATH`** (node signature) and **`CALL_OUTCOME`** (`success` / `failure` / `unknown` via Brain judge at teardown).

## Anti-patterns

- Logging only kinds (`actions: ['sayAndListen']`) without target/reason/text
- Skipping flags like `introSpoken` from memory snapshots
- Relying on assistant speech (“I only caught 9 digits”) as the sole record of a failed extract
- Shipping a routing fix without a `ROUTE_DECISION`-visible rejection reason
- Shipping conversation/routing changes without unit tests that lock the behavior (framework `test/*.test.mjs`, app `projects/*/test/*.test.mjs`)
