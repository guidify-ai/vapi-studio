# Sample Landing LLM — Planner

Tracked Vapi Studio sample on **`:9998`**. Product: Landing Page **Planner LLM** — help a guest design the voice agent they want to build (company → use case → discovery → sample → Help me build it).

Operator surfaces (same runtime as other Studio apps):

- `/flow` — planner graph
- `/analytics` — planner funnels
- `/conversations` — transcripts
- `/studio` — text chat
- `/{projectUuid}/vapi/*` — Vapi ingress

Not the Roofr estimate PoC (`projects/roofr-poc` on `:9999`).

```bash
yarn start   # Docker app + Postgres → http://localhost:9998
```

Brain: `src/brain/brain.config.ts` (ChatGPT when `OPENAI_API_KEY` is set; otherwise MockBrain `config/poc/planner.brain.yml`).
