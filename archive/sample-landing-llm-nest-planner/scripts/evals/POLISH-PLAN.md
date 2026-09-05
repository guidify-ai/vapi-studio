# Sample landing LLM polish (after 50-convo baseline)

**Baseline:** 50/50; `{ sample_thin: 13, reask_identity: 2 }`; FAQ×2 had **0** sample lines.

## What’s good
- Most paths reach design package + Help me build it; funnels/events/flow ~49/50
- Turn counts mostly 6–8

## What’s bad (fixed)
1. Thin samples — floor raised to **10** lines + padded `buildRichSample`
2. FAQ empty sample — false `transfer_human` on design text “transfer to a human”; soft-close without `[[SAMPLE_CALL]]`; harness exited on `offerHelp` alone
3. Identity re-ask — `stripIdentityReask` after intake

## Iterations (≤10 each)

| Iter | Result |
| --- | --- |
| 1 | 9/10 green; FAQ still `sample=0` (undetected) |
| 2 | 9/10; FAQ flagged `sample_missing` — root cause found |
| 3 | Transfer detector fix — **10/10, issue tallies `{}`** |

## Commands
```bash
node scripts/evals/run-25-convos.mjs 10 http://127.0.0.1:9998 --ids=2,4,7,8,16,20,5,9,12,25
```
