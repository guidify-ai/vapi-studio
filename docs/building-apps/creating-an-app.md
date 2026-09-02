# Creating an application

Stand up a NestJS voice bot under **`projects/`** in your Vapi Studio clone.

## 1. Clone and build the framework

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build
```

## 2. Create `projects/<name>/`

```bash
mkdir -p projects/my-voice-app
cd projects/my-voice-app
```

Scaffold a NestJS app (or copy from an [example](./example-apps.md)).

Minimum: `app.module.ts`, `main.ts`, `config/flow.yaml`, `src/conversation/`, `src/vapi/`, `Dockerfile`, `docker-compose.yml`, `.env.example`.

## 3. Depend on Vapi Studio

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:.."
  }
}
```

`file:..` points at the **repository root** (the framework package), not a sibling directory.

```bash
yarn install
```

If you changed framework code: `yarn build` from the repo root, then `yarn install` again in the project if types are stale.

## 4. Register agent steps

Every step class:

1. `@Injectable()` extending `AgentNode<YourSchema>`
2. Listed in `VapiStudioModule.forRoot({ nodes: [{ className, useClass }] })`
3. Referenced in `flow.yaml`

## 5. Vapi HTTP layer (your code)

Implement endpoints that:

- Bootstrap conversations from Vapi webhooks
- Stream Custom LLM SSE via the framework supervisor
- Map `extractVapiCallId` → supervised runtime

See [Vapi adapter](../guide/vapi-adapter.md) for contracts.

## 6. Run

```bash
cd projects/my-voice-app
docker compose up --build
```

(Or whatever run command your project defines.)

## 7. Environment

Keep secrets in `.env` (gitignored). See [Environment variables](../reference/environment-variables.md).

## 8. Project README

`projects/<name>/README.md`: northern stars only — not flow YAML. Conversation design: [best practices](../best-practices/README.md).

## Optional: separate repository

If you must host the app in its own git repo, depend on a published `@guidify-ai/vapi-studio` or `file:../vapi-studio`. The supported default is **`projects/` inside one clone**.
