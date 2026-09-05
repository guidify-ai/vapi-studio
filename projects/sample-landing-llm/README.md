# Sample Landing LLM — Planner

Tracked Vapi Studio sample on **`:9998`**. Product: Landing Page **Planner LLM** — help a guest design the voice agent they want to build (company → use case → discovery → sample → Help me build it).

**LP intake → Conversation seed:** the marketing site collects **company name**, **email**, and **your name** before chat. Those arrive on `POST /studio/conversations/call` as `guestCompanyName` / `contactEmail` / `contactName`, land in memory on open, and are never re-asked (opening greets by name + company; hire uses the email).

**Guidify wrap-up mail (Resend):** on first sample (`SUCCESS_LEAD`), Help me build it (`QUOTE_REQUEST`), and transfer wrap (`TRANSFER_HUMAN`). Requires `RESEND_ENABLED` + `RESEND_API_KEY` + `HOT_LEAD_TO` in this project's `.env` (not the LP Nest path — Studio chat hits `:9998` directly).

**Outbound “Call me”:** `POST /studio/outbound-call` (company + email + name + phone + consent). Places a Vapi outbound call when `VAPI_API_KEY` + `VAPI_PHONE_NUMBER_ID` + `POC_ASSISTANT_ID` are set; always emails Guidify. Intake fields seed call metadata for the phone Conversation.

Operator surfaces (same runtime as other Studio apps):

- `/flow` — planner graph
- `/analytics` — planner funnels (`intake_seeded` when intro fields arrive)
- `/conversations` — transcripts
- `/studio` — text chat
- `/{projectUuid}/vapi/*` — Vapi ingress

```bash
yarn start   # Docker app + Postgres on :9998 + ngrok → PUBLIC_BASE_URL for Vapi
yarn stop    # docker compose down (ngrok stops with Ctrl+C on start)
```

`yarn start` prints the ngrok **Custom LLM** and **webhook** URLs to paste into the Vapi assistant. For outbound **Call me**, also set `VAPI_API_KEY`, `POC_ASSISTANT_ID`, and `VAPI_PHONE_NUMBER_ID` in `.env`.

Brain: `src/brain/brain.config.ts` (ChatGPT when `OPENAI_API_KEY` is set; otherwise MockBrain `config/poc/planner.brain.yml`).
