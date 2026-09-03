# Installation

## Requirements

### Framework (repo root)

- **Node.js 22+**
- **Yarn 1.x**

### Local dev with Vapi (`projects/<name>/`)

- **Docker** with Compose — app + Postgres in containers
- **[ngrok](https://ngrok.com/download)** on your PATH — tunnels `localhost` to HTTPS so Vapi can reach webhooks and Custom LLM
- **Vapi** account and assistant configured with the URLs `yarn start` prints

Framework work (`yarn build`, `yarn test`) does not need Docker or ngrok. Running a bot against live Vapi does.

## Clone and build

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build
```

## Verify

```bash
yarn test
```

## Your project under `projects/`

```bash
mkdir -p projects/my-voice-app
cd projects/my-voice-app
```

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:../.."
  }
}
```

`file:../..` is the framework at the **repository root** (two levels up from `projects/<name>/`).

After framework changes: `yarn build` at the repo root, then `yarn install` in the project if needed.

In the project, `yarn start` starts Docker, launches ngrok on the app port, sets `PUBLIC_BASE_URL` in `.env`, and prints **Webhook** and **Conversation** endpoints for your Vapi assistant. See [Quick start](./quick-start.md).

A private npm registry is optional for teams that split repos later; the default is one clone with `projects/`.

## Agent refs in projects

When your project runs `yarn install`, postinstall copies:

- `.cursor/rules/vapi-studio-best-practices.mdc`
- `AGENTS.md` block

Manual refresh: `INIT_CWD=$PWD node node_modules/@guidify-ai/vapi-studio/scripts/install-agent-refs.cjs`

Next: [Quick start](./quick-start.md) · [`projects/README.md`](../../projects/README.md)
