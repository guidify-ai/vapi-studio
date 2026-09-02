# Vapi adapter

How Vapi Studio compiles node output for Vapi Custom LLM and webhooks.

## Endpoints (app-owned)

Typical PoC routes:

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/vapi/webhook` | Server URL — assistant-request, status-update, tool-calls |
| `POST` | `/vapi/chat/completions` | Custom LLM SSE (single assistant) |
| `POST` | `/vapi/:moduleId/chat/completions` | Per-module URL when Squad workflow loaded |

See [Creating an app](../building-apps/creating-an-app.md) for route patterns in your NestJS app.

## Correlation

- Vapi **call id** (`message.call.id`) maps to supervised runtime via `extractVapiCallId`
- Framework **conversation id** is canonical — never replace with provider id
- Lazy bootstrap: first Custom LLM POST may create runtime if webhook order differs

## Custom LLM SSE contract

1. Open SSE immediately (before Brain HTTP)
2. Run supervisor turn
3. Stream `say` chunks via `VapiSseCompiler`
4. `sayAndListen` — speak then end turn as listening
5. `endCall` / `transferToHuman` — OpenAI-compatible **tool calls** (names must match Vapi assistant tools)
6. Duplicate/stale Custom LLM POSTs: replay on that connection — never empty dead air on live stream

## Tool names (env)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VAPI_END_CALL_TOOL_NAME` | `end_call_tool` | Farewell `endCall` |
| `VAPI_TRANSFER_CALL_TOOL_NAME` | `transferCall` | Human transfer |
| `VAPI_HANDOFF_TOOL_NAME` | `handoff` | Squad module handoff |
| `VAPI_TRANSFER_DESTINATION` | — | E.164 for transfer tool |

Function names on the Vapi assistant **must match** these exactly.

## Webhook strategies (PoC)

| `message.type` | Typical behavior |
| --- | --- |
| `assistant-request` | Bootstrap + return `assistantId` or transient assistant config |
| `call.started` / `assistant.started` | Bootstrap (saved-assistant path) |
| `status-update` | Bootstrap on `in-progress`; finalize on `ended` |
| `tool-calls` | `ra9_still_there` → StillThere portal |
| `user-interrupted` | Record interrupt |

Guard: reject messages missing `message.call.id` → `400`.

## Channel tools

`ctx.tools` — tools advertised on this Custom LLM request  
`ctx.toolResults()` — results from `role: tool` messages (re-entry after tool execution)

## Operator setup

Full dashboard checklist: implement in **your application** — see [Creating an app](../building-apps/creating-an-app.md).

## Related

- [Handbook](./handbook.md)
- [Vapi operator patterns](../guide/vapi-adapter.md)
