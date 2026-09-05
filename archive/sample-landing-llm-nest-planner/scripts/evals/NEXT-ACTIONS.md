# Landing planner — further actions (after polish)

**Status (2026-09-05):** Nest planner chat/draft quality is at practical max for this architecture.  
Batches **9–12** all GATE PASS. Stop infinite eval loops unless a real regression appears.

This plan is ordered by **value / risk**, not by how fun it is to build.

---

## Tier 0 — Ops (do before real traffic)

Goal: emails and env actually work in production.

| # | Action | Done when |
|---|--------|-----------|
| 0.1 | Set `RESEND_ENABLED=true` + valid `RESEND_API_KEY` + verified `RESEND_FROM` | Live send succeeds in Resend dashboard |
| 0.2 | Confirm `HOT_LEAD_TO=mpyskunov@guidify.ca` on the host that serves `vapi-studio.guidify.ca` | One manual transfer + one Help me build it each land in inbox with Outcome codes |
| 0.3 | Smoke each Outcome once | Subjects match `[Vapi Studio] {OUTCOME} — {company}` for `SUCCESS_LEAD`, `QUOTE_REQUEST`, `TRANSFER_HUMAN`, `FAILED_LEAD` |
| 0.4 | Rate limit: set production `RATE_LIMIT_CONVERSATIONS_PER_DAY` (local polish used 500) | Abuse-safe for public site |

**Fail protocol:** if Resend fails, leave wrap-up UX on; log skip; fix keys — do not redesign chat.

---

## Tier 1 — Product trust (still Nest planner)

Goal: ship confidence without Supervisor yet.

| # | Action | Done when |
|---|--------|-----------|
| 1.1 | Wire `npm test` / CI job: `node scripts/evals/run-batch.mjs 12` (or 9) against a staging compose stack | PR red on invariant hits |
| 1.2 | Cache-bust `public/studio.js` / CSS when shipping UI | Visitors see transfer wrap-up copy |
| 1.3 | Optional: one “Help me build it” E2E in harness (form POST → `QUOTE_REQUEST` path stubbed or recorded) | Quote path covered like chat turns |
| 1.4 | Document for Guidify ops: how to read Outcome emails + what to do next | Short section in project README or internal note |

**Out of scope here:** more persona polish, more vertical sample templates, Resend template redesign beyond Outcome pattern.

---

## Tier 2 — Architecture (the real “maximum”)

Goal: landing chat becomes a true Vapi Studio deterministic agent (web channel).

| # | Action | Notes |
|---|--------|-------|
| 2.1 | Spec: web channel + form as caller ID + source `marketing_website` | Align with runtime-api / best-practices |
| 2.2 | Port planner graph to Supervisor nodes/listens (finite, portals, transfer = wrap+email) | Preserve Outcome email semantics |
| 2.3 | Replace Nest design LLM treadmill with Studio brain-at-boundaries only | Fail-closed extracts; one CTA; conversation must end |
| 2.4 | Keep `projects/vapi-studio-landing` as the sample app; migrate code under Studio contracts | Update `docs/reference/runtime-api.md` in same change |
| 2.5 | Eval harness targets Supervisor HTTP/events, not only `/api/design/turn` | New batch suite; retire Nest-only asserts gradually |

**Gate for starting Tier 2:** Tier 0 done (real emails) + product decision that migration is next, not more Nest polish.

---

## Tier 3 — Explicitly not now

- Enabling Resend without a verified domain/from
- Committing `src/private/` or `.env`
- Force-push / amend of polished history without ask
- Unlimited correction fidelity / every niche vertical template
- Replacing Postgres or adding a CRM before Supervisor

---

## Suggested next session order

1. **Tier 0** (30–60 min) — turn mail on, send four Outcome smokes.  
2. **Tier 1.1–1.2** if you want CI/cache-bust before launch.  
3. **Tier 2.1** specify migration only when you want the real Studio sample — treat as a new feature plan (speckit / plan mode), not another eval loop.

## Commands cheat sheet

```bash
cd projects/vapi-studio-landing
docker compose up -d --build app
node scripts/evals/run-batch.mjs 12 http://127.0.0.1:4173   # golden
node scripts/evals/run-batch.mjs 11 http://127.0.0.1:4173   # lifecycle
```

See also: `ITERATION-PLAN.md`, `REGRESSION.md`.
