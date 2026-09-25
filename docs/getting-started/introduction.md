# Introduction

**Vapi Studio** (`@guidify-ai/vapi-studio`) is a NestJS toolkit for **deterministic voice agents** on [Vapi](https://vapi.ai).

Your bot is a **separate NestJS app**. Start from **[vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project)** — clone it, set `PROJECT_NAME`, then own nodes, `flow.yaml`, secrets, and Docker.

## What you get

- Typed agent steps (`AgentNode`), Supervisor routing, optional Brain at listen boundaries
- Forms, tasks, event bus, Studio operator SPA assets
- Docs and agent rules stamped into consumer apps on install

## What you build

A fork of [vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project) that depends on `@guidify-ai/vapi-studio@0.1.0`, with Vapi Custom LLM + webhook at `/vapi/...` on your host.

## What this is not

- A no-code builder or open-ended LLM agent platform
- A Guidify-hosted runtime (you self-host)
- A monorepo of customer bots (each bot is its own starter fork)

Next: [Installation](./installation.md) · [Quick start](./quick-start.md) · [Concepts](../guide/concepts.md)
