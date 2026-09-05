# Landing planner — regression evals

## How to run

```bash
cd projects/vapi-studio-landing
docker compose up -d --build app   # after design.service / harness changes
node scripts/evals/run-batch.mjs 9 http://127.0.0.1:4173
```

| Batch | Purpose |
|-------|---------|
| `7` / `71` | Iteration 1 chat-trust (I1–I5) |
| `8` / `81` | Iteration 2 lead-artifact (A1–A6) |
| `9` / `91` | Golden regression (mixed I* + A*) |

Exit code **0** = `GATE PASS` (avg ≥ 9.5 and zero invariant violations).  
Exit code **1** = `GATE FAIL` — do not ship polish; triage transcripts in `scripts/evals/out/`.

## What red means

Invariant notes are first-class failures (score −2 each). Common codes:

| Code | Meaning |
|------|---------|
| `I1_crm_in_discovery` | CRM/tool token stored in `discoveryAnswers` |
| `I2_sample_claim_without_marker` | Said “sample” without `[[SAMPLE_CALL]]` |
| `I3_brand_greeting_missing` | Brand token not in spoken greeting |
| `I4_hire_missing_crm_ask` | Hire path never asked CRM with empty integration |
| `I5_open_q_after_decline` | Re-asked “anything else?” after decline |
| `A1_usecase_fluff` | Hire/impatient fluff left in `useCase` |
| `A2_dispatch_sample_mismatch` | Dispatch use case without tracking/pickup/ETA sample |
| `A3_roadside_missing_location_urgency` | Fleet/roadside sample missing location/urgency |
| `A4_*` | Transfer answer didn’t close discovery cleanly |
| `A5_*` | Stacked corrections lost brand or overgrown hook |
| `A6_*` | Rebrand missed `companyName` or `companyDoes` |

## Fail protocol

1. Stop feature work for the next iteration.
2. Triage top recurring invariant hits (not avgScore alone).
3. Smallest server guard > prompt tweak.
4. Re-run `71` / `81` / `91` (max 2 retries), then waive in `ITERATION-PLAN.md` if still red.

## Stop list (do not polish further here)

Without a Supervisor / deterministic-agent migration, stop chasing:

- Pixel-perfect samples for every niche vertical beyond packaged templates
- Unlimited correction fidelity beyond persisted `spokenBrand` / `sampleCallerHook`
- Resend email enablement (product decision)
- `marketing_website` channel / real Vapi Studio Supervisor graph

**Done for this Nest planner:** hot-lead drafts from batch 9 are sendable without hand-fix on covered paths.

## Waivers

_(none)_
