# Introduction

**Vapi Studio** (`@guidify-ai/vapi-studio`) is a NestJS toolkit for **deterministic voice agents** on [Vapi](https://vapi.ai).

Clone once. Framework code lives at the repo root; your bots live in **`projects/`**.

Routing and business logic live in typed **agent steps** and a small `flow.yaml` path file. A **Brain** adapter may interpret caller speech at listen boundaries — it does not own the graph.

## Current scope

**Deterministic agent orchestration only.** Explicit paths, portals, extracts, and forensics. Broader autonomous-agent patterns are future work.

## What this repository is

- The **framework package** (`src/`) — supervisor, agent steps, flow loader, Brain port, forms, Vapi SSE adapter, events, persistence
- **`projects/`** — your NestJS voice apps (see [`projects/README.md`](../../projects/README.md))
- **Documentation** — `docs/` + [best practices](./../best-practices/README.md)
- **Tests** — `yarn test` at the repo root

## What this repository is not

- A deployable product by itself (no bot runs until you add `projects/<name>/`)
- A no-code builder or general-purpose LLM agent platform

## Layout

```text
vapi-studio/
├── src/                      ← framework (import as @guidify-ai/vapi-studio)
├── docs/
└── projects/
    └── my-voice-app/         ← Docker, flow.yaml, Vapi webhooks
        package.json          ← "@guidify-ai/vapi-studio": "file:../.."
```

## Local development

Bots run in **Docker** on `localhost`. Live Vapi testing uses **[ngrok](https://ngrok.com/download)** to tunnel that port to HTTPS (`yarn start` in a project starts both). See [Installation](./installation.md).

## Next

1. [Installation](./installation.md)
2. [Quick start](./quick-start.md)
3. [Creating an app](../building-apps/creating-an-app.md)
