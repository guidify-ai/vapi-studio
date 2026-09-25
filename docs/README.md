# Vapi Studio documentation

**[@guidify-ai/vapi-studio](https://github.com/guidify-ai/vapi-studio)** — deterministic voice agents for Vapi (NestJS).

**Current scope:** deterministic agent orchestration — explicit paths, typed agent steps, optional Brain at listen boundaries. Not a general LLM agent platform.

**New bot?** Clone **[vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project)** — do not scaffold from this framework repo.

---

## Getting started

| Page | Description |
| --- | --- |
| [Introduction](./getting-started/introduction.md) | What Vapi Studio is |
| [Installation](./getting-started/installation.md) | Clone starter → `yarn install` |
| [Quick start](./getting-started/quick-start.md) | Clone, name, `yarn start`, wire Vapi |

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
| [Overview](./building-apps/overview.md) | Framework vs starter vs showcase |
| [Creating an app](./building-apps/creating-an-app.md) | Clone [vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project) and extend |
| [Example apps](./building-apps/example-apps.md) | Starter + Planner showcase |

## Best practices

| Page | Description |
| --- | --- |
| [Index](./best-practices/README.md) | Conversation-design doctrine |

## Guides

| Page | Description |
| --- | --- |
| [Documentation layers](./best-practices/documentation-layers.md) | What to update when |
| [Agents & Cursor](./guides/agents.md) | AGENTS.md, rules |
| [SpecKit](./guides/speckit.md) | Framework specify → plan → tasks |
| [ARDs](./ards/README.md) | Architecture decision records (PR requirement) |
| [Node conventions](./guides/node-conventions.md) | Naming, lifecycle, Brain SLOs |
| [Extending events](./guides/extending-events.md) | Attach logic to the event bus (Nest + Redis samples) |
| [Event samples](./samples/events/) | Copy-paste `onStudioEvent` / Nest listener examples |

## Reference

| Page | Description |
| --- | --- |
| [Environment variables](./reference/environment-variables.md) | Framework env · [`.env.example`](../.env.example) |
| [Flow schema](./reference/flow-schema.md) | `flow.yaml` |
| [Data model](./reference/data-model.md) | Persistence |
| [Events & logging](./reference/events-and-logging.md) | Event catalog, bus, forensics |
| [Standard intentions](./reference/standard-intentions.md) | `STANDARD_INTENTIONS` |
| [Runtime API](./reference/runtime-api.md) | Shipped contracts |
| [Security](./reference/security.md) | Secrets policy |
| [Testing](./reference/testing.md) | `yarn test` |
| [Contributing](../CONTRIBUTING.md) | PR checklist + ARD rule |

## Handbook

Runtime API: [reference/runtime-api.md](./reference/runtime-api.md) · Entry index: [../README.md](../README.md)
