# Creating an application

Start from the public starter **[vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project)**. That repo is the Nest shell for your bot: `flow.yaml`, Vapi routes, Docker, agent rules. This package (`@guidify-ai/vapi-studio`) is the framework it depends on — not an app template.

Do not put production secrets or customer flows in the framework repository.

## 1. Clone the starter

```bash
git clone git@github.com:guidify-ai/vapi-studio-project.git my-bot
cd my-bot
cp .env.example .env
# Edit PROJECT_NAME=…  (PROJECT_SLUG optional — defaults from the name)
yarn install
yarn start   # Docker Postgres + app + ngrok → prints Vapi URLs
```

`yarn install` pulls `@guidify-ai/vapi-studio@0.1.0` and stamps Cursor/Claude rules + `AGENTS.md`. Postinstall syncs `config/project.identity.json` from `PROJECT_NAME` / `PROJECT_SLUG` (name + slug only).

## 2. Wire Vapi

Paste the printed URLs into your Vapi assistant:

| Setting | Endpoint |
| --- | --- |
| **Webhook** | `{PUBLIC_BASE_URL}/vapi/webhook` |
| **Custom LLM** | `{PUBLIC_BASE_URL}/vapi/chat/completions` |

Each starter fork is its own deploy (own host / port / ngrok URL). Paths are host-scoped — no project UUID in the URL.

## 3. Build your conversation

1. Add `@Injectable()` classes extending `AgentNode<YourSchema>` under `src/conversation/`
2. Register them in `VapiStudioModule.forRoot({ nodes: [...] })` in `app.module.ts`
3. Reference them from `config/flow.yaml`
4. Grow `src/vapi/` as needed (webhook strategies, tools) — see the [showcase](https://github.com/guidify-ai/vapi-studio-landing-page-sample-model) for a full Planner PoC

Operator UI (`/flow`, `/conversations`) comes from the framework SPA mounted by the starter.

## 4. Keep going

- [Vapi adapter](../guide/vapi-adapter.md) — Custom LLM SSE + webhooks
- [Module setup](../guide/module-setup.md) — `VapiStudioModule.forRoot`
- [Best practices](../best-practices/README.md) — conversation design doctrine
- [Runtime API](../reference/runtime-api.md) — shipped contracts

## Framework contributors

Clone [vapi-studio](https://github.com/guidify-ai/vapi-studio) only when changing the library itself (`yarn build`, `yarn test`). Apps always start from [vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project).
