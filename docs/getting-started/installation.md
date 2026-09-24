# Installation

**[@guidify-ai/vapi-studio](https://www.npmjs.com/package/@guidify-ai/vapi-studio)** is a public npm package. Your voice bot is a **separate NestJS app** that depends on it.

Vapi Studio apps are **self-hosted** and **Dockerized**. There is no Guidify-hosted runtime. Vapi is the cloud voice channel; your containers serve Custom LLM + webhook.

## Requirements

- **Node.js 22+**
- **Yarn 1.x** or npm
- **Docker** + Compose (to run a live call stack)
- **[ngrok](https://ngrok.com/download)** for local HTTPS to Vapi
- A **Vapi** account

## Install into your app

```bash
yarn add @guidify-ai/vapi-studio@0.1.0
# or: npm install @guidify-ai/vapi-studio@0.1.0
```

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "0.1.0"
  }
}
```

Wire `VapiStudioModule.forRoot(...)` in your Nest module, add `flow.yaml` + nodes, and run with Docker. See [Quick start](./quick-start.md) and [Creating an app](../building-apps/creating-an-app.md).

On install, the package **postinstall** stamps agent rules (`AGENTS.md`, `.cursor/rules/…`) into your app when present.

## What is published (and what is not)

The npm tarball includes **`dist/`**, **`docs/`**, **`agent/`**, **`scripts/`**, **`LICENSE`**, **`README.md`**. It does **not** include `.env`, secrets, sample apps, or private bots.

## Contribute to the framework (optional)

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build
yarn test
```

Public usage showcase (separate repo): [vapi-studio-sample-landing-llm](https://github.com/guidify-ai/vapi-studio-sample-landing-llm).

## Agent refs

```bash
INIT_CWD=$PWD node node_modules/@guidify-ai/vapi-studio/scripts/install-agent-refs.cjs
```

Next: [Quick start](./quick-start.md) · [Creating an app](../building-apps/creating-an-app.md)
