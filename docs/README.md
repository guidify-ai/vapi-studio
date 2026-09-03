# Vapi Studio documentation

**[@guidify-ai/vapi-studio](https://github.com/guidify-ai/vapi-studio)** — deterministic voice agents for Vapi (NestJS).

**Current scope:** deterministic agent orchestration — explicit paths, typed agent steps, optional Brain at listen boundaries. Not a general LLM agent platform.

This repo ships the **framework** at the root and your **applications** under [`projects/`](../projects/README.md).

---

## Getting started

| Page | Description |
| --- | --- |
| [Introduction](./getting-started/introduction.md) | What Vapi Studio is |
| [Installation](./getting-started/installation.md) | Clone, build, test |
| [Quick start](./getting-started/quick-start.md) | Build the package and wire it into your app |

## Guide

| Page | Description |
| --- | --- |
| [Concepts](./guide/concepts.md) | Conversations, supervisor, agent steps, flow, brain |
| [Module setup](./guide/module-setup.md) | `VapiStudioModule.forRoot` |
| [Forms](./guide/forms.md) | `expose` / `open` / `resend` |
| [Vapi adapter](./guide/vapi-adapter.md) | Custom LLM SSE, webhooks |
| [Workflow & Squad](./guide/workflow-squad.md) | Multi-assistant handoffs (optional) |
| [Handbook](./guide/handbook.md) | → package root `README.md` |

## Building applications

NestJS apps under **`projects/`** in the same clone.

| Page | Description |
| --- | --- |
| [Projects folder](../projects/README.md) | Where your bots live |
| [Overview](./building-apps/overview.md) | Framework vs `projects/<app>` boundaries |
| [Creating an app](./building-apps/creating-an-app.md) | Scaffold, depend (`file:../..`), run |
| [Example apps](./building-apps/example-apps.md) | Patterns to copy into `projects/` |

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

## Reference

| Page | Description |
| --- | --- |
| [Environment variables](./reference/environment-variables.md) | Framework env |
| [Flow schema](./reference/flow-schema.md) | `flow.yaml` |
| [Data model](./reference/data-model.md) | Persistence |
| [Events & logging](./reference/events-and-logging.md) | Forensics |
| [Standard intentions](./reference/standard-intentions.md) | `STANDARD_INTENTIONS` |
| [Runtime API](./reference/runtime-api.md) | Shipped contracts (handbook) |
| [Security](./reference/security.md) | Secrets policy |
| [Testing](./reference/testing.md) | `yarn test` |

## Handbook

Runtime API (canonical): [reference/runtime-api.md](./reference/runtime-api.md) · Entry index: [../README.md](../README.md)
