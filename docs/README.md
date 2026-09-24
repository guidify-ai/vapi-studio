# Vapi Studio documentation

**[@guidify-ai/vapi-studio](https://github.com/guidify-ai/vapi-studio)** — deterministic voice agents for Vapi (NestJS).

**Current scope:** deterministic agent orchestration — explicit paths, typed agent steps, optional Brain at listen boundaries. Not a general LLM agent platform.

Install the package into your NestJS app. A public usage sample lives in a **separate** repo: [vapi-studio-sample-landing-llm](https://github.com/guidify-ai/vapi-studio-sample-landing-llm).

---

## Getting started

| Page | Description |
| --- | --- |
| [Introduction](./getting-started/introduction.md) | What Vapi Studio is |
| [Installation](./getting-started/installation.md) | npm install |
| [Quick start](./getting-started/quick-start.md) | Minimal Nest wiring |

## Guide

| Page | Description |
| --- | --- |
| [Concepts](./guide/concepts.md) | Conversations, supervisor, agent steps, flow, brain |
| [Module setup](./guide/module-setup.md) | `VapiStudioModule.forRoot` |
| [Forms](./guide/forms.md) | `expose` / `open` / `resend` |
| [Vapi adapter](./guide/vapi-adapter.md) | Custom LLM SSE, webhooks |
| [Workflow & Squad](./guide/workflow-squad.md) | Multi-assistant handoffs (optional) |
| [Handbook](./guide/handbook.md) | Pointer → [Runtime API](./reference/runtime-api.md) |

## Building applications

| Page | Description |
| --- | --- |
| [Overview](./building-apps/overview.md) | Framework package vs your app |
| [Creating an app](./building-apps/creating-an-app.md) | Scaffold and depend on npm |
| [Example apps](./building-apps/example-apps.md) | Public sample link |

## Best practices

| Page | Description |
| --- | --- |
| [Index](./best-practices/README.md) | Conversation-design doctrine |

## Guides

| Page | Description |
| --- | --- |
| [Documentation layers](./best-practices/documentation-layers.md) | What to update when |
| [Agents & Cursor](./guides/agents.md) | AGENTS.md, rules |
| [Node conventions](./guides/node-conventions.md) | Naming, lifecycle, Brain SLOs |
| [Extending events](./guides/extending-events.md) | Event-driven hooks |

## Reference

| Page | Description |
| --- | --- |
| [Environment variables](./reference/environment-variables.md) | Framework env |
| [Flow schema](./reference/flow-schema.md) | `flow.yaml` |
| [Data model](./reference/data-model.md) | Persistence |
| [Events & logging](./reference/events-and-logging.md) | Event bus, forensics |
| [Standard intentions](./reference/standard-intentions.md) | `STANDARD_INTENTIONS` |
| [Runtime API](./reference/runtime-api.md) | Shipped contracts |
| [Security](./reference/security.md) | Secrets policy |
| [Testing](./reference/testing.md) | `yarn test` |

## Handbook

Runtime API: [reference/runtime-api.md](./reference/runtime-api.md) · Entry index: [../README.md](../README.md)
