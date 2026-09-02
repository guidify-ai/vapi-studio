# Agents: Vapi Studio

You are working in a NestJS app that depends on `@guidify-ai/vapi-studio`.

## Mandatory reading (best practices)

Before changing conversation copy, agent steps, listens, extracts, or identity/SMS flows, read:

1. `docs/best-practices/README.md` (index)
2. The matching guide under `docs/best-practices/` (conversation design, nodes and listens, identity and PII, debugging and observability, documentation layers)

Resolve paths from the installed package:

```text
node_modules/@guidify-ai/vapi-studio/docs/best-practices/
```

In a **vapi-studio** source checkout, the same files live at `docs/best-practices/` in the repo root.

## Hard rules (summary)

- **One CTA per turn** — never stack unrelated questions; prefer more agent steps / `continueTo`.
- **Fail closed** on constrained fields (e.g. NA phone = exactly 10 digits).
- **Listen timeouts** match answer type (short for digits).
- **Do not store ASR junk** as names or profile verify summaries.
- **Logs/events must explain the call** — if you cannot answer “why this step / what was said / what memory changed” from daily logs + `conversation_events`, add structured fields in the same change (`docs/best-practices/debugging-and-observability.md`).
- **Update docs in the same change** — framework README for behavior; best-practices guides for doctrine; app README for northern stars only.

Runtime contracts (Supervisor, Brain, Vapi, env): package `README.md`.
