# Installation

**[@guidify-ai/vapi-studio](https://www.npmjs.com/package/@guidify-ai/vapi-studio)** is a public npm package. Your voice bot is a **separate NestJS app** that depends on it — same idea as installing a framework and maintaining your own application code.

Vapi Studio apps are **self-hosted** and **Dockerized**. There is no Guidify-hosted runtime. Vapi is the cloud voice channel; your containers serve Custom LLM + webhook.

## Requirements

- **Node.js 22+**
- **Yarn 1.x** or npm
- **Docker** + Compose (to run a live call stack)
- **[ngrok](https://ngrok.com/download)** for local HTTPS to Vapi
- A **Vapi** account

## Install into your app (recommended)

In your application directory (private repo, or any folder you own):

```bash
yarn add @guidify-ai/vapi-studio
# or: npm install @guidify-ai/vapi-studio
```

Pin a version when you care about upgrades:

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "0.1.0"
  }
}
```

Wire `VapiStudioModule.forRoot(...)` in your Nest module, add `flow.yaml` + nodes, and run with Docker. See [Quick start](./quick-start.md) and [Creating an app](../building-apps/creating-an-app.md).

On `yarn install` / `npm install`, the package **postinstall** stamps agent rules (`AGENTS.md`, `.cursor/rules/…`) into your app when present.

## What is published (and what is not)

The npm tarball includes **`dist/`**, **`docs/`**, **`agent/`**, **`scripts/`**, **`LICENSE`**, **`README.md`**. It does **not** include:

- `.env` / secrets
- `projects/` (sample lives in the GitHub repo only)
- Docker volumes, lab orchestrators, or private apps

Never put API keys in the package source. Apps keep secrets in their own `.env` (gitignored).

## Contribute to the framework (optional)

Clone the public repo if you are changing the framework itself or running the tracked sample:

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build
yarn test
```

Tracked sample: `projects/sample-landing-llm/` (`yarn start` → http://127.0.0.1:9998/flow).

Framework developers may use `"@guidify-ai/vapi-studio": "file:../.."` inside `projects/<name>/`. Application teams should depend on the **published** version.

## Agent refs

Manual refresh after upgrading the package:

```bash
INIT_CWD=$PWD node node_modules/@guidify-ai/vapi-studio/scripts/install-agent-refs.cjs
```

Next: [Quick start](./quick-start.md) · [Creating an app](../building-apps/creating-an-app.md)
