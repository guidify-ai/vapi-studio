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
# from repo root
yarn new-project
# or: yarn new-project --name "My Voice App" --slug my-voice-app --yes
cd projects/<slug>
```

This writes a Nest skeleton plus **`config/project.identity.json`** (stable ingress UUID). Prefer that over hand-mkdir. You can still copy patterns from an [example](./example-apps.md).

Minimum: `app.module.ts` (including `StudioUiModule.forRoot()`), `main.ts` (`mountStudioUiAssets`), `config/project.identity.json`, `config/flow.yaml`, `src/conversation/`, `src/vapi/`, `Dockerfile`, `docker-compose.yml`, `.env.example`.

Operator UI is the **framework React SPA** (`/flow`, `/conversations`, `/analytics`) — not per-app HTML shells.

## 3. Depend on Vapi Studio

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:../.."
  }
}
```

`file:../..` points at the **repository root** (two levels up from `projects/<name>/`).

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

Local dev needs **Docker** and **[ngrok](https://ngrok.com/download)**. The app listens on `localhost`; ngrok publishes HTTPS so Vapi can POST webhooks and Custom LLM traffic.

```bash
cd projects/my-voice-app
yarn start   # Docker + ngrok (see scripts/start.sh in example apps)
```

Ship a `start` script in `package.json` that brings up Docker, waits for `/health`, starts **ngrok** on the app port, writes `PUBLIC_BASE_URL` to `.env`, and prints the two URLs your Vapi assistant needs:

| Vapi assistant setting | Endpoint |
| --- | --- |
| **Webhook** | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/webhook` |
| **Conversation** (Custom LLM) | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/chat/completions` |

Each app owns a stable UUID in **`config/project.identity.json`**. `yarn start` / app boot **upserts** it into the Postgres `projects` table (create or exist). Do not regenerate the id after wiring Vapi.

Example apps use `scripts/start.sh` → `docker compose up -d --build`, health checks, then ngrok on the app port. Callers should use **`yarn start`**, not raw `docker compose`.

First time in the project: `yarn install` after you add the `file:../..` dependency.

## 7. Environment

Keep secrets in `.env` (gitignored). See [Environment variables](../reference/environment-variables.md).

## 8. Project README

`projects/<name>/README.md`: northern stars only — not flow YAML. Conversation design: [best practices](../best-practices/README.md).

## Optional: separate repository

If you must host the app in its own git repo, depend on a published `@guidify-ai/vapi-studio` or `file:../vapi-studio`. The supported default is **`projects/` inside one clone**.
