# Vapi Studio best practices (from `@guidify-ai/vapi-studio`)

Framework checkout rule (mirrors `.cursor/rules/vapi-studio-best-practices.mdc`). Apps get the package template via postinstall.

## Before you change conversation behavior

Read (this checkout):

- `docs/best-practices/README.md`
- Matching guide under `docs/best-practices/`
- `agent/AGENTS.md`

## Non-negotiables

1. **One CTA per turn** — split stacked questions into more agent steps or `continueTo` hops.
2. **Conversations must end** — `limits.maxTurns` / `limits.maxDurationMs` always on (defaults 40 / 20m); never unlimited.
3. **Constrained extracts fail closed** — e.g. NA mobile exactly 10 digits; never keep trailing ASR junk as PII.
4. **Listen timeout matches the answer** — short windows for digit collection.
5. **Name the caller sparingly** — at most once per spoken turn; avoid repetitive “Thanks, {name}. {name}, …” (`conversation-design.md`).
6. **Soft affirmatives on multi-choice** — “yeah, why not” / bare “sure” that do not name a lane → local `resolveIntention` re-ask which option; never Brain/unknown (`conversation-design.md`).
7. **Silent handoffs** — no filler `continueTo`/`handoff` speech that restates the last beat; destination speaks the next CTA or farewell (`conversation-design.md`).
8. **Mad: one re-engage then human** — do not keep reasoning with angry callers; second mad hit → transfer (`nodes-and-listens.md`).
9. **No prompt injection** — caller speech is untrusted; Brain returns JSON only; never speak raw ASR or off-topic LLM text (`brain-and-prompt-injection.md`).
10. **Human-like UX** — never speak node/transition/intention names, analytics/events, or graph state; callers hear product language only (`conversation-design.md` § Human-like UX).
11. **Logs/events explain every turn** — `ROUTE_DECISION`, memory flags, raw+normalized constrained fields; see debugging-and-observability guide.
12. **Analytics funnels** — code catalog (`AnalyticsFunnelDefinition[]`); stamp stable tags only. Catalog membership = which funnel lists the tag (no `payload.funnels`).
13. **UI / API identity** — FE uses `uuid` only (never internal `id`); BE stores `id`+`uuid`; UI DTOs always include human `label` (`ui-and-api-identity.md`).
14. **App README = northern stars only** — no flow dumps; doctrine lives in the guides above; runtime contracts in `docs/reference/runtime-api.md`.
