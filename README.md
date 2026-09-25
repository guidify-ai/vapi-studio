# Vapi Studio

**[@guidify-ai/vapi-studio](https://www.npmjs.com/package/@guidify-ai/vapi-studio)** — a **code-driven toolkit for [Vapi](https://vapi.ai)**.

**Website:** [vapi-studio.guidify.ca](https://vapi-studio.guidify.ca)

This repo is the **framework** (npm package). Your bot is a separate NestJS app — start from the public starter below.

---

## Create a new project

```bash
git clone git@github.com:guidify-ai/vapi-studio-project.git my-bot
cd my-bot
cp .env.example .env
# Edit PROJECT_NAME=…  (PROJECT_SLUG optional)
yarn install
yarn start   # Docker + Postgres + ngrok
```

Wire Vapi to the printed URLs:

| Setting | URL |
| --- | --- |
| Webhook | `{PUBLIC_BASE_URL}/vapi/webhook` |
| Custom LLM | `{PUBLIC_BASE_URL}/vapi/chat/completions` |

- Starter: [guidify-ai/vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project)
- Walkthrough: [Creating an app](./docs/building-apps/creating-an-app.md)
- Quick start: [docs/getting-started/quick-start.md](./docs/getting-started/quick-start.md)

**Requirements:** Node 22+, Yarn or npm, Docker Compose, [ngrok](https://ngrok.com/download), a Vapi account.

**Showcase (not a blank starter):** [vapi-studio-landing-page-sample-model](https://github.com/guidify-ai/vapi-studio-landing-page-sample-model) — Planner LLM demo.

---

## Repos

| Repo | Role |
| --- | --- |
| **This package** | [`guidify-ai/vapi-studio`](https://github.com/guidify-ai/vapi-studio) → `@guidify-ai/vapi-studio` on npm |
| **Starter** | [`guidify-ai/vapi-studio-project`](https://github.com/guidify-ai/vapi-studio-project) — fork this to ship a bot |
| **Showcase** | [`guidify-ai/vapi-studio-landing-page-sample-model`](https://github.com/guidify-ai/vapi-studio-landing-page-sample-model) — full Planner sample |

**Self-hosted and Dockerized.** No Guidify-hosted runtime. Vapi is the voice channel; your app is the Custom LLM + webhook endpoint.

<p align="center">
  <img src="./docs/assets/vapi-studio-stack.svg" alt="Vapi to Vapi Studio to nodes to optional Brain" width="720" />
</p>

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

**Vapi Studio** — [Introduction](./docs/getting-started/introduction.md) · [Concepts](./docs/guide/concepts.md) · [Runtime API](./docs/reference/runtime-api.md).

**Conversation events** — [Events & logging](./docs/reference/events-and-logging.md) · [Extending events](./docs/guides/extending-events.md).

---

## How it fits with Vapi

Vapi Studio assistants are **Custom LLM + webhook** endpoints — fully compatible with ordinary Vapi assistants:

| # | Mode | When to use |
| --- | --- | --- |
| 1 | **Single-assistant flow** | New bots. One Vapi assistant; the graph lives in Studio (`flow.yaml` + nodes). |
| 2 | **Multi-assistant Squad** | Several Studio-backed assistants in one Squad. See [Workflow & Squad](./docs/guide/workflow-squad.md). |
| 3 | **Inject into an existing Squad** | Mix Studio and native Vapi members in Squads you already run. |

Most greenfield work starts with **(1)** via the starter clone above.

---

## How multi-intention routing works

One listen can surface **several competing intentions**. Main path left → right; portal nodes on a row below.

<p align="center">
  <img src="./docs/assets/deterministic-assistant-flow.svg" alt="Multi-intention flow: main path left to right, three lane branches, portal nodes below, re-entry loop" width="1200" />
</p>

**Supervisor** picks the next agent step each turn (scores intentions, checks portals, follows `flow.yaml`).

| Shape | Meaning |
| --- | --- |
| **NODE** | Agent step — speaks, listens, writes memory |
| **PORTAL NODE** | Global interrupt (`portal: true` in `flow.yaml`) |
| **INTENTION** | Routing signal on an edge |

---

## Contribute to the framework

Only when changing this library (not when starting a bot):

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install && yarn build && yarn test
```

---

## Documentation

| | |
| --- | --- |
| **Create a new project** | [Starter](https://github.com/guidify-ai/vapi-studio-project) · [Creating an app](./docs/building-apps/creating-an-app.md) |
| Showcase | [landing-page-sample-model](https://github.com/guidify-ai/vapi-studio-landing-page-sample-model) · [Example apps](./docs/building-apps/example-apps.md) |
| Doc site index | [`docs/README.md`](./docs/README.md) |
| Runtime handbook | [`docs/reference/runtime-api.md`](./docs/reference/runtime-api.md) |
| Best practices | [`docs/best-practices/`](./docs/best-practices/) |
| Env presets | [`.env.example`](./.env.example) |

## License

MIT — see [LICENSE](./LICENSE).
