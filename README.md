# Vapi Studio

**[@guidify-ai/vapi-studio](https://www.npmjs.com/package/@guidify-ai/vapi-studio)** — a **code-driven toolkit for [Vapi](https://vapi.ai)**.

**Website:** [vapi-studio.guidify.ca](https://vapi-studio.guidify.ca) — live sample, product overview, and hire Guidify.

This repository is the **public** source for the npm package. Install it into **your** NestJS app; keep your bot and secrets in your own repo.

```bash
yarn add @guidify-ai/vapi-studio@0.1.0
```

```text
vapi-studio/              ← this repo (framework only)
├── src/                  ← published as dist/ on npm
├── docs/
├── agent/
└── package.json          ← name: @guidify-ai/vapi-studio
```

Showcase usage lives in a **separate** public sample app: [vapi-studio-sample-landing-llm](https://github.com/guidify-ai/vapi-studio-sample-landing-llm) (Planner LLM on `:9998`). Your production bot is another Nest app that depends on this package the same way.

**Self-hosted and Dockerized.** You run the NestJS app and Postgres on **your** infrastructure. There is no Guidify-hosted runtime. Vapi stays the voice channel; your Studio app is the Custom LLM + webhook endpoint.

<p align="center">
  <img src="./docs/assets/vapi-studio-stack.svg" alt="Vapi to Vapi Studio to nodes to optional Brain" width="720" />
</p>

Product tools (same catalog as [vapi-studio.guidify.ca](https://vapi-studio.guidify.ca)): **five named surfaces** plus room for more. Shipped docs live under [`docs/`](./docs/README.md).

---

## Tools

| # | Tool | Status | Summary |
| --- | --- | --- | --- |
| 1 | **Vapi Studio** | Shipped | Deterministic agents — typed steps + `flow.yaml`. Supervisor routes every turn; Brain only at listen boundaries. |
| 2 | **Conversation events** | Shipped | Event-driven bus — `onStudioEvent` + Nest `eventListeners`. Build any custom logic on the hooks; Guidify tools use the same surface. |
| 3 | **Vapi Custom Transcriber** | Coming soon | Controllable ASR for digit listens, names, and constrained extracts — fewer junk transcripts as PII. |
| 4 | **Vapi Voice Profiles** | Coming soon | Reusable voice + persona packs for Vapi assistants — consistent brand sound across flows. |
| 5 | **Vapi Integrations** | Coming soon | Signed outbound hooks to CRM and tools — BYOK wiring without leaking provider protocols into Nodes. |
| — | **And more** | Coming soon | More controllable surfaces for Vapi — same self-hosted stack, same graph-owned philosophy. |

**Vapi Studio (deterministic agents)** — [Introduction](./docs/getting-started/introduction.md) · [Concepts](./docs/guide/concepts.md) · [Runtime API](./docs/reference/runtime-api.md).

**Conversation events** — [Events & logging](./docs/reference/events-and-logging.md) · [Extending events](./docs/guides/extending-events.md).

---

## How it fits with Vapi

Vapi Studio assistants are **Custom LLM + webhook** endpoints — fully compatible with ordinary Vapi assistants. You choose how much of the call graph lives in Studio:

| # | Mode | When to use |
| --- | --- | --- |
| 1 | **Single-assistant flow** | New bots. One Vapi assistant; the complex conversation graph lives in Vapi Studio (`flow.yaml` + nodes). Lane jumps use `continueTo` — no Squad required. |
| 2 | **Multi-assistant Squad** | Several Studio-backed assistants in one Vapi Squad. Studio `handoff` switches members while keeping one Conversation. See [Workflow & Squad](./docs/guide/workflow-squad.md). |
| 3 | **Inject into an existing Squad** | Drop Studio assistants into Squads you already run in Vapi. They speak the same Custom LLM / tool / handoff contracts as native members, so you can mix Studio and non-Studio assistants. |

Most greenfield work starts with **(1)**.

---

## How multi-intention routing works

One listen can surface **several competing intentions**. The flow chart reads **left to right** on the main path; lane branches stack with space to breathe; **portal nodes** sit on a row **below** so edges and labels do not cross node text.

<p align="center">
  <img src="./docs/assets/deterministic-assistant-flow.svg" alt="Multi-intention flow: main path left to right, three lane branches, portal nodes below, re-entry loop" width="1200" />
</p>

**Supervisor** — framework component that picks the next agent step each turn (scores intentions, checks portal nodes, then follows `flow.yaml`).

| Shape | Meaning |
| --- | --- |
| **NODE** | Agent step on the main path — speaks, listens, writes memory; one node may expose many outbound intentions |
| **PORTAL NODE** | Same agent-step shape with `portal: true` in `flow.yaml` — global interrupt (goodbye, transfer, still-there, …) |
| **INTENTION** | Routing signal on an edge (app-defined or `studio.is*`) — multiple edges can share a target |

---

## Install

```bash
yarn add @guidify-ai/vapi-studio@0.1.0
```

Wire `VapiStudioModule.forRoot(...)` in your Nest app, add `flow.yaml` + nodes, run with Docker. See [Installation](./docs/getting-started/installation.md) · [Quick start](./docs/getting-started/quick-start.md) · [Creating an app](./docs/building-apps/creating-an-app.md).

**Requirements:** Node 22+, Yarn or npm; for a live stack — Docker Compose + ngrok (local) + a Vapi account.

```bash
# contribute to the framework
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install && yarn build && yarn test
```

Scaffold a new app directory (any path you choose):

```bash
npx --yes # or from a clone:
yarn new-project   # creates ./<slug>/ with package.json depending on @guidify-ai/vapi-studio
```

**Sample showcase** (separate repo): [vapi-studio-sample-landing-llm](https://github.com/guidify-ai/vapi-studio-sample-landing-llm).

---

## Documentation

| | |
| --- | --- |
| Doc site index | [`docs/README.md`](./docs/README.md) |
| Runtime handbook | [`docs/reference/runtime-api.md`](./docs/reference/runtime-api.md) |
| Best practices | [`docs/best-practices/`](./docs/best-practices/) |
| Example apps | [`docs/building-apps/example-apps.md`](./docs/building-apps/example-apps.md) |

## License

MIT — see [LICENSE](./LICENSE).
