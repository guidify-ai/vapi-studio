# Installation

## New bot (recommended)

You do **not** install the framework into an empty folder by hand. Clone the starter — it already depends on the package:

```bash
git clone git@github.com:guidify-ai/vapi-studio-project.git my-bot
cd my-bot
cp .env.example .env
yarn install   # installs @guidify-ai/vapi-studio@0.1.0 + stamps agent rules
yarn start
```

Starter: [guidify-ai/vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project)  
Package: [npm `@guidify-ai/vapi-studio`](https://www.npmjs.com/package/@guidify-ai/vapi-studio)

Vapi Studio apps are **self-hosted** and **Dockerized**. There is no Guidify-hosted runtime. Vapi is the cloud voice channel; your containers serve Custom LLM + webhook.

## Requirements

- **Node.js 22+**
- **Yarn 1.x** or npm
- **Docker** + Compose
- **[ngrok](https://ngrok.com/download)** for local HTTPS to Vapi
- A **Vapi** account

On install, the package **postinstall** stamps agent rules (`AGENTS.md`, `.cursor/rules/…`) into the starter when present.

## What is published (and what is not)

The npm tarball includes **`dist/`**, **`docs/`**, **`agent/`**, **`scripts/`**, **`LICENSE`**, **`README.md`**. It does **not** include `.env`, secrets, or application bots.

## Contribute to the framework (optional)

Only when changing the library itself:

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build
yarn test
```

## Agent refs (manual)

```bash
INIT_CWD=$PWD node node_modules/@guidify-ai/vapi-studio/scripts/install-agent-refs.cjs
```

Next: [Quick start](./quick-start.md) · [Creating an app](../building-apps/creating-an-app.md)
