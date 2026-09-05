# Landing planner — next 3 polish iterations

**Bar:** a Guidify hot-lead draft you’d send without hand-fixing.  
**Not in scope:** Supervisor migration, Resend on, public commit of `src/private/`.  
**Ops:** Docker Compose app on `:4173`; rebuild after code changes; `node scripts/evals/run-batch.mjs <n>`.  
**Assumption:** each iteration can fail — do not advance until the gate passes (or a documented waiver).

---

## Shared fail protocol (every iteration)

If the batch fails the gate:

1. **Stop** — do not start the next iteration’s feature work.
2. **Triage** — top 3 recurring failures from transcripts (not score average).
3. **Fix only those** — smallest server guards > prompt tweaks.
4. **Re-run the same batch id** (e.g. `71` = retry of `7`) until gate passes or 2 retries exhausted.
5. After 2 failed retries: **narrow the gate**, log waivers in this file, continue — do not infinite-loop.

Harness rule: prefer **invariant asserts** over raw avgScore. Avg 10 with wrong artifacts still fails.

---

## Iteration 1 — Prove last fixes (trust the chat)

### Goal
Silent failures from batch 6 are gone in conversation behavior.

### Must-pass invariants
| ID | Invariant |
|----|-----------|
| I1 | CRM/tool tokens (`HubSpot`, `Salesforce`, …) never appear in `draft.discoveryAnswers` |
| I2 | Any assistant turn that claims a sample includes `[[SAMPLE_CALL]]` and draft has ≥6 sample lines |
| I3 | After “say GreenLeaf” (or brand token), first bot sample line is `Thanks for calling GreenLeaf…` (not only legal name / “Hello, this is…”) |
| I4 | Hire → sample path asks CRM once if `integrationInterest` empty (before sticky close) |
| I5 | Sticky decline: after “nothing else” / “Better. Nothing else.”, later soft affirmatives do **not** re-open “anything else?” |

### Work
- Confirm post–batch-6 guards are live in the container (rebuild if needed).
- Add harness asserts for I1–I5 in `run-batch.mjs` (fail note + score penalty ≥2 each).
- Batch **7**: 10–12 personas aimed at these five only (HVAC+Salesforce mid-discovery, GreenLeaf stack, Atlas hire, Ledgerly decline, Metro Solar HubSpot).

### Gate (pass / fail)
- **Pass:** avg ≥ 9.5 **and** zero I1–I5 violations across the batch.
- **Fail:** any I1–I5 hit → fail protocol; retry as batch **71**.

### If still failing after 2 retries
- Waive the weakest invariant (likely I3 brand edge cases), harden the rest with deterministic string guards, proceed to Iteration 2 with waiver noted below.

**Waivers:** _(none)_

### Iteration 1 result (2026-09-05)
- Batch **7**: GATE FAIL — 1× `I3_brand_greeting_missing` (#3 stacked corrections).
- Fix: persist `spokenBrand` across corrections.
- Batch **71**: GATE PASS — avg 10.0, 0 invariant hits.

---

## Iteration 2 — Lead artifact trust (trust the draft)

### Goal
The persisted draft matches what the guest described — Guidify can quote from JSON alone.

### Must-pass invariants
| ID | Invariant |
|----|-----------|
| A1 | `useCase` has no hire/impatient fluff (`want Guidify`, `stop fluff`, `help me build`) |
| A2 | Vertical sample match: dispatch/ETA use case ⇒ sample mentions tracking/pickup/ETA (not “new project”) |
| A3 | Roadside/booking (FleetCare-class) ⇒ sample asks location + urgency (not identity-only) |
| A4 | Transfer/must-know answered ⇒ `discoveryComplete` without an extra soft-confirm multi-question |
| A5 | Stacked corrections: later edits do not wipe earlier proven changes (e.g. overgrown + GreenLeaf both remain) |
| A6 | `companyDoes` / rebrand: midstream rebrand updates `companyName` and keeps business description |

### Work
- Server: `sanitizeUseCase` coverage; `sampleMismatchesUseCase` expansion; discovery-complete on transfer answers; correction merge (don’t rebuild from scratch wiping prior hints).
- Harness asserts A1–A6.
- Batch **8**: 12–15 personas (dispatch, hire hygiene, FleetCare, rebrand, GreenLeaf multi-correct, dental transfer, impatient plumber).

### Gate
- **Pass:** avg ≥ 9.5 **and** zero A1–A6 violations; `callerNeedsMet` true for all.
- **Fail:** retry **81**; same fail protocol.

### If still failing after 2 retries
- Accept model samples that are “close enough” only when `ensureDesignPackage` rewrite path is proven for that vertical; waive A3 or A5 with a follow-up ticket — do not block Iteration 3 on one vertical.

**Waivers:** _(none)_

### Iteration 2 result (2026-09-05)
- Batch **8**: GATE PASS — avg 10.0, 0 A* violations (first try).

---

## Iteration 3 — Close the loop (trust the process)

### Goal
Polish is **measurable and non-regressing**; leftover work is explicit, not tribal knowledge.

### Must-pass outcomes
| ID | Outcome |
|----|---------|
| P1 | Harness fails CI-style on I* + A* (local script exit non-zero on violations) |
| P2 | One “golden” batch **9** (15 mixed personas) with no I*/A* violations |
| P3 | Short `scripts/evals/REGRESSION.md`: how to run, what red means, current waivers |
| P4 | Explicit **stop list**: what we will not polish further without Supervisor migration |

### Work
- Wire `run-batch.mjs` to `process.exit(1)` when any invariant note fires.
- Batch **9** = regression suite (merge of 7+8 stress cases).
- Document stop list: Resend, Supervisor/`marketing_website`, pixel-perfect every vertical template, unlimited correction fidelity.

### Gate
- **Pass:** batch 9 clean (zero invariant violations) + REGRESSION.md written + stop list agreed in that file.
- **Fail:** retry **91** once; if still red, ship with waivers frozen and stop polish (architecture limit).

### Iteration 3 result (2026-09-05)
- `REGRESSION.md` written with runbook, red codes, fail protocol, stop list.
- Harness exits non-zero on invariant hits (`GATE FAIL`).
- Batch **9**: GATE PASS — avg 10.0, 15/15 clean, 0 invariant hits.
- **Nest planner polish max reached** for covered paths; further gains → Supervisor migration.

### Post-polish (2026-09-05) — transfer + mail pattern
- Transfer-to-human wraps chat + patterned `TRANSFER_HUMAN` email.
- Batch **10**: GATE PASS — avg 10.0, T1/T2 + regression slice, 0 invariant hits.
- Batch **11**: GATE PASS — guest_exit vs transfer lifecycle, 0 hits.
- Batch **12**: GATE PASS — full golden re-run (15), 0 hits.

### Done definition (maximum for this Nest planner)
Hot-lead draft is sendable without hand-fix on happy + stressed paths covered by batch 9. Further gains require Supervisor migration, not more chat loops.

---

## Suggested tomorrow order

1. Read this file + latest `scripts/evals/out/batch6-*.json` spot failures.
2. Iteration 1 → gate → only then Iteration 2 → gate → Iteration 3.
3. Do **not** enable Resend or start Supervisor work in these three iterations.

## Commands cheat sheet

```bash
cd projects/vapi-studio-landing
docker compose up -d --build app
node scripts/evals/run-batch.mjs 7   # then 71 / 8 / 81 / 9 / 91 as needed
```
