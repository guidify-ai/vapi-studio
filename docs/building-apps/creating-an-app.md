# Creating an application

Install **[@guidify-ai/vapi-studio](https://www.npmjs.com/package/@guidify-ai/vapi-studio)** into **your** NestJS app. Study the public sample [vapi-studio-sample-landing-llm](https://github.com/guidify-ai/vapi-studio-sample-landing-llm) — do not put production secrets in the framework repo.

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

## 2. Scaffold

Copy from the [sample](https://github.com/guidify-ai/vapi-studio-sample-landing-llm) or run `yarn new-project` from a framework clone (creates `./<slug>/` in the current working directory).

Minimum: `app.module.ts` (including `StudioUiModule.forRoot()`), `main.ts` (`mountStudioUiAssets`), `config/project.identity.json`, `config/flow.yaml`, `src/conversation/`, `src/vapi/`, `Dockerfile`, `docker-compose.stub.yaml`, `.env.example`.

Operator UI is the **framework React SPA** (`/flow`, `/conversations`).

## 3. Register agent steps

1. `@Injectable()` extending `AgentNode<YourSchema>`
2. Listed in `VapiStudioModule.forRoot({ nodes: [{ className, useClass }] })`
3. Referenced in `flow.yaml`

## 4. Vapi HTTP layer (your code)

Bootstrap from webhooks, stream Custom LLM SSE via the supervisor, map `extractVapiCallId` → runtime. See [Vapi adapter](../guide/vapi-adapter.md).

## 5. Run

```bash
yarn start   # Docker + ngrok
```

| Vapi assistant setting | Endpoint |
| --- | --- |
| **Webhook** | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/webhook` |
| **Conversation** (Custom LLM) | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/chat/completions` |

Keep a stable UUID in **`config/project.identity.json`**.

## Contributors

Clone [vapi-studio](https://github.com/guidify-ai/vapi-studio) to change the framework itself.
