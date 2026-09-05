# Quickstart / Operator Runbook

> **Historical.** Canonical docs: [docs/getting-started/quick-start.md](../../docs/getting-started/quick-start.md). Repo: [guidify-ai/vapi-studio](https://github.com/guidify-ai/vapi-studio).

## Layout (monorepo)

```text
vapi-studio/
├── packages/ra9/           # framework package
└── projects/roofr-poc/     # Nest application
```

## Prerequisites

- Docker + Docker Compose
- ngrok (or equivalent) on the operator machine
- Access to Roofr Vapi account (operator-owned)
- Optional: OpenAI key later; MVP uses mock Brain

Host Node/Yarn installs are **not** required.

## Workspace paths

```text
vapi-studio/packages/ra9/
vapi-studio/projects/roofr-poc/
```

## Start stack

From `vapi-studio/projects/roofr-poc`:

```bash
cp .env.example .env
# set OPENAI_API_KEY; yarn start will set PUBLIC_BASE_URL from ngrok
yarn start              # baked Nest + Postgres + ngrok (prefer OrbStack)
curl -s http://localhost:9999/health
```

Expected services:

- `app` HTTP on `localhost:9999`
- `postgres` on `localhost:15432` (and private compose network)

Health check:

```bash
curl -s http://localhost:9999/health
```

## Environment

Copy `.env.example` → `.env` (never commit secrets):

- `DATABASE_URL`
- `PUBLIC_BASE_URL` (ngrok HTTPS origin)
- `POC_BRAIN_PROFILE=state-machine` or `transfer-human`
- `VAPI_TRANSFER_DESTINATION` (phone/assistant target for Scenario 2)
- optional `VAPI_WEBHOOK_SECRET`
- optional `OPENAI_API_KEY` (unused by mock Brain)

## Tunnel

```bash
ngrok http 9999
```

Set Vapi phone number Server URL to:

`https://<ngrok>/vapi/webhook`

**Create exactly one Vapi assistant** (not a Squad). Point its Custom LLM URL at:

`https://<ngrok>/vapi/chat/completions`

On that assistant, advertise `endCall` / `end_call_tool` and `transferCall` if you need human transfer. Optional: set `POC_ASSISTANT_ID` to the assistant id so `assistant-request` returns `{ assistantId }`.

Exact Vapi dashboard field names vary; capture screenshots/notes during first setup.

Do **not** paste `config/vapi-squad.example.json` for this PoC.

## Acceptance Scenario 1 (state machine)

1. Set `POC_BRAIN_PROFILE=state-machine`, restart app container.
2. Place inbound call.
3. Follow scripted turns (acknowledge → multi-say with pauses → interrupt → goodbye/end).
4. Verify logs for:
   - bootstrap Conversation + `runtimeInstanceId`
   - same `runtimeInstanceId` each Custom LLM turn
   - ranked intentions including `ra9.isGoodbye`
   - multiple `say` emissions
   - interrupt observation
   - `endCall` tool stream
   - `status-update ended` finalize + registry removal

## Acceptance Scenario 2 (transfer portal)

1. Set `POC_BRAIN_PROFILE=transfer-human`, configure transfer destination, restart.
2. Place inbound call.
3. First transfer intention → re-engagement speech, no transfer.
4. Second transfer intention → real `transferCall`.
5. End call; verify portal counter was in-memory and durable row ended cleanly.

## Build notes for agents

All `yarn install` / `yarn build` / tests for Node packages MUST run inside Docker, e.g.:

```bash
docker compose run --rm app yarn test
```

(Exact service name finalized during scaffold.)
