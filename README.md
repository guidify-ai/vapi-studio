# Vapi Studio

**[@guidify-ai/vapi-studio](https://github.com/guidify-ai/vapi-studio)** — a **code-driven toolkit for [Vapi](https://vapi.ai)**.

**Website:** [vapi-studio.guidify.ca](https://vapi-studio.guidify.ca) — live sample, product overview, and hire Guidify.

This repository is the **public** source for **[@guidify-ai/vapi-studio](https://www.npmjs.com/package/@guidify-ai/vapi-studio)** on npm. Install it into your NestJS app; keep your bot and secrets in **your** private repo.

```bash
yarn add @guidify-ai/vapi-studio
```

```text
vapi-studio/              ← this repo (framework source + docs + sample)
├── src/                  ← published as dist/ on npm
├── docs/
├── projects/
│   └── sample-landing-llm/   ← tracked public sample (:9998)
└── package.json          ← name: @guidify-ai/vapi-studio
```

Your production app (e.g. a private `roofr-poc`) lives **elsewhere** and depends on a published version (`0.1.0`, …). Other local folders under `projects/` stay gitignored so they never leak into the OSS tree; only the sample is tracked.

**Self-hosted and Dockerized.** You run the NestJS app and Postgres on **your** infrastructure. There is no Guidify-hosted runtime. Vapi stays the voice channel; your Studio app is the Custom LLM + webhook endpoint.

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

**Conversation events** — event-driven forensics and extension hooks. Subscribe with `onStudioEvent` or Nest `eventListeners`; emit app events with `EventService.persist`. OSS does not limit what you build on those hooks — Guidify’s own tools integrate the same way. [Events & logging](./docs/reference/events-and-logging.md) · [Extending events](./docs/guides/extending-events.md).

---

## How it fits with Vapi

Vapi Studio assistants are **Custom LLM + webhook** endpoints — fully compatible with ordinary Vapi assistants. You choose how much of the call graph lives in Studio:

| # | Mode | When to use |
| --- | --- | --- |
| 1 | **Single-assistant flow** | New bots. One Vapi assistant; the complex conversation graph lives in Vapi Studio (`flow.yaml` + nodes). Lane jumps use `continueTo` — no Squad required. |
| 2 | **Multi-assistant Squad** | Several Studio-backed assistants in one Vapi Squad. Studio `handoff` switches members while keeping one Conversation. See [Workflow & Squad](./docs/guide/workflow-squad.md). |
| 3 | **Inject into an existing Squad** | Drop Studio assistants into Squads you already run in Vapi. They speak the same Custom LLM / tool / handoff contracts as native members, so you can mix Studio and non-Studio assistants. |

Most greenfield work starts with **(1)**. Use **(2)** when you want separate Vapi assistants per lane. Use **(3)** when Studio owns only part of a larger Squad.

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

Solid arrows = main path and intention routes. Dashed arrows = portal-node interrupts or lane re-entry loops.

**Layout convention:** main conversation path **left → right**; lane branches get vertical space; **portal nodes** on a row **below** the main path (so labels and edges stay readable). Example apps should use the same layout in Flow Studio (`/flow`). Future **call replay** can highlight visited nodes and dim the rest.

Example apps render the full interactive graph at **`/flow`** (Flow Studio).

---

## References

| What | Where |
| --- | --- |
| **Documentation** | [`docs/README.md`](./docs/README.md) — install, guides, building apps |
| **Best practices** | [`docs/best-practices/`](./docs/best-practices/) — conversation doctrine (one CTA, PII, forensics) |
| **Agent-first RAD** | [`agent/AGENTS.md`](./agent/AGENTS.md) · [`agent/CLAUDE.md`](./agent/CLAUDE.md) · postinstall → Cursor + Claude Code rules · [Agents & CLIs](./docs/guides/agents.md) |
| **Runtime API** | [`docs/reference/runtime-api.md`](./docs/reference/runtime-api.md) — shipped contracts (update with code changes) |
| **Example apps** | [`docs/building-apps/example-apps.md`](./docs/building-apps/example-apps.md) · [`projects/`](./projects/README.md) |

---

## Install & run

### Deployment model

| Piece | Where it runs |
| --- | --- |
| **Vapi** (telephony, ASR/TTS, assistant config) | Vapi cloud |
| **Your Studio app** (Supervisor, nodes, Brain, webhooks) | **Self-hosted** — Docker Compose locally, or containers/VM you operate |
| **Postgres** (conversations / checkpoints) | **Self-hosted** beside the app (Compose `postgres` by default). Event durability beyond the process is application-owned via listeners. |

Local and production alike: ship the app as **containers**. Host Node/Yarn is for **framework build and scaffolding** (`yarn build`, `yarn new-project`); the live call process is Docker.

### Requirements

| Layer | Tools |
| --- | --- |
| **Framework** (repo root) | **Node.js 22+**, **Yarn 1.x** (build / test / scaffold) |
| **App runtime** (in `projects/<name>/`) | **Docker** + **Docker Compose** |
| **Local Vapi calls** | **[ngrok](https://ngrok.com/download)** on your PATH, Vapi account |

Vapi runs in the cloud and must call your machine over **HTTPS**. Local dev uses **ngrok** to tunnel the Docker-published port (example apps use **9999**) to a public URL. `yarn start` in a project starts **Docker Compose** **and** ngrok, writes `PUBLIC_BASE_URL` to `.env`, and prints the Webhook + Conversation links below.

Optional root orchestration: copy **`Makefile.stub`** → gitignored **`Makefile`**, then `make start`. The stub boots the tracked sample; your local Makefile can chain private ecosystem targets (`start-ecosystem-analytics`, …) before `start-vapi-studio`.

### 1. Clone and build

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build    # framework → dist/
yarn test     # optional verify
```

### 2. Add your project

```bash
yarn new-project   # interactive name + slug → projects/<slug>/ + project.identity.json
```

Bots live in **`projects/`** — no second repo, no sibling folder:

```text
vapi-studio/
├── src/                  ← framework
└── projects/
    └── my-voice-app/     ← your NestJS app
```

```json
// projects/my-voice-app/package.json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:../.."
  }
}
```

```bash
cd projects/my-voice-app
yarn install   # first time, or after you change dependencies
yarn start     # Docker Compose (app + Postgres) + ngrok; prints Vapi-ready URLs
```

**Wire into Vapi** — `yarn start` prints an HTTPS origin (ngrok) and two URLs to paste into your Vapi assistant:

| Vapi assistant setting | Endpoint |
| --- | --- |
| **Webhook** | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/webhook` |
| **Conversation** (Custom LLM) | `{PUBLIC_BASE_URL}/{PROJECT_UUID}/vapi/chat/completions` |

`PUBLIC_BASE_URL` is the ngrok HTTPS origin (new each time ngrok restarts unless you use a reserved domain). Example apps use `scripts/start.sh` (invoked by `yarn start`) — **Compose up --build**, health check, ngrok tunnel, then the link block above. For non-local deploys, point the same Vapi URLs at your self-hosted HTTPS origin and run the same Docker image/stack without ngrok.

Before the first call, wire `VapiStudioModule`, `config/flow.yaml`, and Vapi HTTP routes in the project. See [`projects/README.md`](./projects/README.md) · [Creating an app](./docs/building-apps/creating-an-app.md) · [Installation](./docs/getting-started/installation.md).

After framework changes: `yarn build` at the repo root, then reinstall in the project if needed.

---

## License

[MIT](./LICENSE)
