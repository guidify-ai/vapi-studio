# Creating an application

Install **[@guidify-ai/vapi-studio](https://www.npmjs.com/package/@guidify-ai/vapi-studio)** into **your** NestJS app (private repo). The tracked sample lives under **`projects/sample-landing-llm/`** in the public GitHub tree for reference — copy patterns from it; do not put production secrets in the OSS repo.

## 1. Depend on the package

```bash
yarn add @guidify-ai/vapi-studio@0.1.0
```

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "0.1.0"
  }
}
```

Framework contributors editing the clone may use `"file:../.."` or `"file:../guidify-ai"` temporarily. Ship private apps against a **published** version.

## 2. Scaffold

Copy from [sample-landing-llm](https://github.com/guidify-ai/vapi-studio/tree/main/projects/sample-landing-llm) or run `yarn new-project` from a framework clone (writes under `projects/<slug>` for experiments). Prefer a **sibling / private** app directory for anything with customer data.

Minimum: `app.module.ts` (including `StudioUiModule.forRoot()`), `main.ts` (`mountStudioUiAssets`), `config/project.identity.json`, `config/flow.yaml`, `src/conversation/`, `src/vapi/`, `Dockerfile`, `docker-compose.stub.yaml`, `.env.example`.

Operator UI is the **framework React SPA** (`/flow`, `/conversations`) — not per-app HTML shells.

## 3. Register agent steps

Every step class:

1. `@Injectable()` extending `AgentNode<YourSchema>`
2. Listed in `VapiStudioModule.forRoot({ nodes: [{ className, useClass }] })`
3. Referenced in `flow.yaml`

## 4. Vapi HTTP layer (your code)

Implement endpoints that:

- Bootstrap conversations from Vapi webhooks
- Stream Custom LLM SSE via the framework supervisor
- Map `extractVapiCallId` → supervised runtime

See [Vapi adapter](../guide/vapi-adapter.md) for contracts.

## 5. Run

Local dev needs **Docker** and **[ngrok](https://ngrok.com/download)**. The app listens on `localhost`; ngrok publishes HTTPS so Vapi can POST webhooks and Custom LLM traffic.

```bash
yarn start   # Docker + ngrok (see scripts/start.sh in the sample)
```

Ship a `start` script that brings up Docker, waits for `/health`, starts **ngrok**, writes `PUBLIC_BASE_URL` to `.env`, and prints:

| Vapi assistant setting | Endpoint |
| --- | --- |
| **Webhook** | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/webhook` |
| **Conversation** (Custom LLM) | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/chat/completions` |

Each app owns a stable UUID in **`config/project.identity.json`**. Do not regenerate it after wiring Vapi.

## Contributors / local lab

Clone [vapi-studio](https://github.com/guidify-ai/vapi-studio) to change the framework. Optional sibling **`guidify-lab`** orchestrates shared Postgres/Redis for private stacks — not published to npm.
