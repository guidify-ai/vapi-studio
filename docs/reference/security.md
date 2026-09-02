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

## Test doubles

Framework and app tests may use values like `sk-mock-not-real` — never real API keys.

## Related

- [Environment variables](./environment-variables.md)
- [Creating an app](../building-apps/creating-an-app.md)
