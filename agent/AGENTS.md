# Agents: Vapi Studio

You are working in a NestJS app that depends on `@guidify-ai/vapi-studio`.

## Mandatory reading (best practices)

Before changing conversation copy, agent steps, listens, extracts, or identity/SMS flows, read:

1. `docs/best-practices/README.md` (index)
2. The matching guide under `docs/best-practices/` (conversation design, nodes and listens, identity and PII, debugging and observability, documentation layers)

Resolve paths from the installed package:

```text
node_modules/@guidify-ai/vapi-studio/docs/best-practices/
```

In a **vapi-studio** source checkout, the same files live at `docs/best-practices/` in the repo root.

## Hard rules (summary)

- **One CTA per turn** — never stack unrelated questions; prefer more agent steps / `continueTo`.
- **Conversations must end** — framework `limits.maxTurns` / `limits.maxDurationMs` always apply (defaults 40 / 20m); never ship unlimited calls (`docs/best-practices/conversation-design.md`).
- **Fail closed** on constrained fields (e.g. NA phone = exactly 10 digits).
- **Listen timeouts** match answer type (short for digits).
- **Do not store ASR junk** as names or profile verify summaries.
- **Name the caller sparingly** — at most once per spoken turn; no “Thanks, {name}. {name}, …” stacks without a clear reason (`docs/best-practices/conversation-design.md`).
- **Soft affirmatives on multi-choice** — “yeah, why not” / “sure” that do **not** name a lane are not a choice; `resolveIntention` must re-ask which option locally — never leave that to Brain/unknown (`conversation-design.md` § Do not auto-pick lanes).
- **Mad: one re-engage then human** — do not reason with angry callers across multiple turns; first mad hit = one short re-engage, still mad = transfer (`nodes-and-listens.md` § Mad).
- **Portal re-engage needs a CTA** — transfer/mad/after-hours deferrals must end with one clear ask, not a dead-end statement (`nodes-and-listens.md`).
- **Silent handoffs** — `continueTo` / `handoff` must not speak filler that restates what just happened before the next real CTA or farewell (`conversation-design.md` § Copy hygiene).
- **No prompt injection surface** — Brain JSON only; never speak raw `userText` or off-topic LLM output (`docs/best-practices/brain-and-prompt-injection.md`).
- **Human-like UX** — never speak node/transition/intention names, event types, or graph state to the caller; product language only (`docs/best-practices/conversation-design.md` § Human-like UX).
- **Logs/events must explain the call** — if you cannot answer “why this step / what was said / what memory changed” from daily logs + `conversation_events`, add structured fields in the same change (`docs/best-practices/debugging-and-observability.md`).
- **Analytics funnels** — code catalog (`AnalyticsFunnelDefinition[]`); stamp tags only (`persistAnalyticsTag` / `stampAnalyticsTag`). Catalog step bindings decide which chart a tag appears on — do not put `funnels[]` on the event.
- **UI / API identity** — FE and external clients use `uuid` only (never internal `id`); durable rows are `id` + `uuid`; every UI DTO includes human `label` so the UI never prints UUIDs as titles (`docs/best-practices/ui-and-api-identity.md`).
- **Update docs in the same change** — `docs/reference/runtime-api.md` for behavior; best-practices guides for doctrine; app README for northern stars only.
- **TypeScript style** — explicit `public` / `protected` / `private` on every class member; typed class properties (no bare `name = '…'`). Run `yarn lint` in the framework repo.

Runtime contracts (Supervisor, Brain, Vapi, env, public API): `docs/reference/runtime-api.md`. Package root `README.md` is an entry index only.
