# Projects

Your Vapi bots live here — inside the same clone as the framework.

```text
vapi-studio/
├── src/                  ← framework (do not put product code here)
├── docs/
└── projects/
    └── my-voice-app/     ← your NestJS app (Docker, flow.yaml, Vapi routes)
```

## Local development

Example apps run the Nest app and Postgres in **Docker** on `localhost` (port **9999** by default). **Vapi cannot reach localhost** — local dev uses **[ngrok](https://ngrok.com/download)** to expose that port as HTTPS. Install ngrok once (`brew install ngrok` or download from ngrok.com), sign in if prompted, then use `yarn start` (not raw `docker compose`).

```text
Vapi (cloud)  →  ngrok HTTPS URL  →  localhost:9999  →  Docker (app + Postgres)
```

## Create a project

From the **repo root** (after `yarn install && yarn build`):

```bash
yarn new-project
# asks for display name + slug; writes projects/<slug>/ with a stable UUID
```

Or non-interactive:

```bash
yarn new-project --name "My Voice App" --slug my-voice-app --yes
```

Canonical identity lives in **`config/project.identity.json`** (`id` / `slug` / `name`). The UUID is generated **once** at scaffold time — never with `uuidV4()` at runtime. Do not rotate `id` after wiring Vapi.

```bash
cd projects/<slug>
yarn install
yarn start     # Docker + ngrok; upserts UUID into Postgres; prints Vapi URLs
```

`yarn start` reads the identity file, mirrors `PROJECT_UUID` into `.env`, boots the app (which **upserts** the row into the `projects` table), then prints:

| Vapi assistant setting | Endpoint |
| --- | --- |
| **Webhook** | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/webhook` |
| **Conversation** (Custom LLM) | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/chat/completions` |

Paste those into your Vapi assistant before placing a test call. Do not call `docker compose` directly unless debugging.

After framework changes: `yarn build` at the repo root, then reinstall in the project if needed.

## What goes in a project

- `config/flow.yaml`, agent steps, copy, `.env`, Docker
- `README.md` with northern stars only (no flow dumps)

Framework mechanics stay in the repo root (`src/`, `docs/`). See [Creating an app](../docs/building-apps/creating-an-app.md).

## Examples

Copy patterns from [example apps](../docs/building-apps/example-apps.md). A full PoC may live at `projects/roofr-poc/` locally (gitignored by default).

## Separate git repo (optional)

Teams that need a dedicated repository can still publish or clone a project elsewhere and depend on `@guidify-ai/vapi-studio` from npm or `file:../vapi-studio`. The default path is **`projects/` in this clone**.
