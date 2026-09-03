# Security

## Framework repository

This repo should contain **no secrets**:

- No `OPENAI_API_KEY` or Vapi tokens in source or committed config
- No real caller PII in fixtures or tests
- Use obvious placeholders in docs (e.g. fictional phone numbers in best-practice examples)

## Consuming applications

Your NestJS project under `projects/<name>/` should:

- Keep secrets in `.env` — **gitignored**
- Ship `.env.example` with empty values only
- Treat runtime logs (`LOG_DIR`) as sensitive in production

## Prompt injection (caller speech)

Caller audio / ASR is **untrusted**. A user asking for a pancake recipe, jailbreak, or “ignore previous instructions” must not change agent behavior or produce spoken off-topic answers.

Vapi Studio’s deterministic model:

- **Brain** returns JSON only (intention scores + allowlisted extract fields) — never caller-facing prose
- **Supervisor + agent steps** own routing and **all spoken copy**
- Framework Brain adapters apply [`brainUntrustedInputRules`](./best-practices/brain-and-prompt-injection.md), candidate allowlists, and extract sanitization

App authors must not echo raw `userText` or Brain `reason` to the caller, and must not add unconstrained sidecar LLM chat on the same call.

Full guide: **[Brain and prompt injection](./best-practices/brain-and-prompt-injection.md)**.

## Test doubles

Framework and app tests may use values like `sk-mock-not-real` — never real API keys.

## Related

- [Environment variables](./environment-variables.md)
- [Creating an app](../building-apps/creating-an-app.md)
- [Brain and prompt injection](../best-practices/brain-and-prompt-injection.md)
