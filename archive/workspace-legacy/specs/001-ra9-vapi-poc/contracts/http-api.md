# Contract: HTTP API (roofr-poc)

Base URL: operator tunnel (ngrok) → host port `9999` (container listens on `9999`).

## `GET /health`

**Response** `200`:

```json
{ "status": "ok" }
```

## `POST /vapi/webhook`

All Vapi Server URL messages.

### Guard

- Require `message.call.id` (string, non-empty) before application logic.
- On missing id → `400` with structured error body; log rejection.

### Envelope (logical)

```json
{
  "message": {
    "type": "assistant-request | status-update | user-interrupted | ...",
    "call": { "id": "<vapi-call-id>", "...": "..." },
    "status": "ended | ...",
    "...": "provider fields"
  }
}
```

Exact provider payloads are observed/logged at runtime; strategies map known types.

### Strategies

| message.type | Strategy | Success behavior |
|--------------|----------|------------------|
| `assistant-request` | AssistantRequestStrategy | Create durable Conversation + supervised runtime; return assistant config referencing Custom LLM URL |
| `status-update` (`ended`) | StatusUpdateStrategy | Finalize, persist, remove runtime; `200` |
| `user-interrupted` | UserInterruptedStrategy | Record interrupt observation on runtime; `200` |
| other | no-op/log | `200` without crashing |

### Assistant-request response (logical)

Must satisfy Vapi assistant-request expectations and point model to:

`POST {PUBLIC_BASE_URL}/vapi/chat/completions`

Include any required server URL / metadata fields discovered during operator setup; document final shape in runbook after first live payload capture.

## `POST /vapi/chat/completions`

OpenAI-compatible Custom LLM endpoint (SSE).

### Correlation

- Extract Vapi call id from request body/metadata (exact field confirmed during first live call; candidates logged).
- Resolve `SupervisedConversation` by call id; if missing → `404`/`409` with clear log (no active-call rebuild).

### Behavior

1. Identify newest user message for this turn.
2. Open the SSE response immediately (before Brain HTTP) so Vapi does not stall on headers.
3. Run Supervisor turn (Brain → MAY → CAN → DO). ChatGPT path: no pre-scan listen-hold; Brain abort ≤ 3s; target first speech chunk < 1.5s p95.
4. Duplicate / stale Custom LLM POSTs from Vapi (same utterance replayed while a turn is in flight) are a provider artifact. Process or replay on **that** HTTP response. Never complete the latest stream with empty assistant content (dead air). Do not add Node “stale repeat” conversation logic.
5. Stream adapter-compiled SSE chunks for `say` / terminal actions.
6. Support multi-second gaps between chunks (connection stays open).
7. On client abort/disconnect, mark interruption-related turn state.

### Streaming output (adapter-owned)

- Intermediate `say`: audible partial assistant content + provider flush conventions as required by Vapi.
- `sayAndListen`: final spoken prompt then end SSE as listening turn.
- `endCall`: OpenAI-compatible tool-call stream for end call (exact tool schema validated live).
- `transferToHuman`: OpenAI-compatible tool-call stream for `transferCall`.

## Auth

MVP: optional shared secret header if operator configures one (`VAPI_WEBHOOK_SECRET`); not required to block scaffolding. Never commit secrets.
