# Sample landing LLM (`projects/sample-landing-llm`)

**Tracked** Vapi Studio sample: the Nest planner LLM that powers the marketing landing chat.

| | |
| --- | --- |
| Port | **9998** (`roofr-poc` keeps **9999**) |
| Analytics | http://127.0.0.1:9998/analytics |
| API | `/api/design`, `/api/leads` |

The marketing site (`projects/vapi-studio-landing`, **gitignored**) is a separate front on `:4173` and should call this sample’s API — it is not the sample itself.

## Local

```bash
cp .env.example .env
# set OPENAI_API_KEY

npm install
docker compose up -d --build
# http://127.0.0.1:9998
# http://127.0.0.1:9998/analytics
```

Seed planner volume for analytics:

```bash
node scripts/evals/run-25-convos.mjs 50 http://127.0.0.1:9998
```

## Secrets

`.env` and `src/private/` stay local — never commit.
