# Vapi Studio

**[@guidify-ai/vapi-studio](https://github.com/guidify-ai/vapi-studio)** — a **code-driven toolkit for [Vapi](https://vapi.ai)**.

<p align="center">
  <img src="./docs/assets/vapi-studio-stack.svg" alt="Vapi to Vapi Studio to agent steps to optional Brain" width="720" />
</p>

This repository ships NestJS libraries at the **repo root** (`src/`, `@guidify-ai/vapi-studio`). Your bots live in **`projects/`** in the same clone — no `packages/` layer, no second repository required.

```text
vapi-studio/
├── src/                  ← framework
├── docs/
├── projects/             ← your NestJS apps (`file:..`)
│   └── my-voice-app/
└── package.json
```

Project **content** under `projects/` is gitignored by default; only `projects/README.md` is tracked.

New tools will appear here as they are built. Documentation for how to use them lives under [`docs/`](./docs/README.md).

---

## Tools

| # | Tool | Status | Summary |
| --- | --- | --- | --- |
| 1 | **Deterministic Assistant for Vapi** | Shipped | Typed agent steps + `flow.yaml` paths. Supervisor routes each turn; Brain interprets speech only at listen boundaries — it does not own the graph. |

More tools may be added later. Each gets its own section here when shipped.

**Deterministic Assistant** — start at [Introduction](./docs/getting-started/introduction.md) · [Concepts](./docs/guide/concepts.md) · [Runtime API](./docs/reference/runtime-api.md).

---

## How multi-intention routing works

One listen can surface **several competing intentions**. The flow chart makes every candidate edge visible before you wire nodes — hub fan-out, merge into the same target, lane loops, and global portals.

<p align="center">
  <img src="./docs/assets/deterministic-assistant-flow.svg" alt="Multi-intention flow: routerTriage hub with three lanes, re-entry loop, and goodbye, transfer, and stillThere portals" width="720" />
</p>

**Supervisor** — framework component that picks the next agent step each turn (scores intentions, checks portals, then follows `flow.yaml`).

| Shape | Meaning |
| --- | --- |
| **HUB** | One node, many outbound intentions — e.g. triage after acknowledge |
| **NODE** | Agent step class — speaks, listens, writes memory |
| **INTENTION** | Routing signal on an edge (app-defined or `studio.is*`) — multiple edges can share a target |
| **PORTAL** | Global interrupt (`portal: true` in `flow.yaml`) — goodbye, transfer, still-there, … |

Solid arrows = main path and intention routes. Dashed arrows = portal interrupts or lane re-entry loops.

Example apps render the full interactive graph at **`/flow`** (Flow Studio).

---

## References

| What | Where |
| --- | --- |
| **Documentation** | [`docs/README.md`](./docs/README.md) — install, guides, building apps |
| **Best practices** | [`docs/best-practices/`](./docs/best-practices/) — conversation doctrine (one CTA, PII, forensics) |
| **Agent-first RAD** | [`agent/AGENTS.md`](./agent/AGENTS.md) · postinstall → `.cursor/rules/vapi-studio-best-practices.mdc` · [Agents & Cursor](./docs/guides/agents.md) |
| **Runtime API** | [`docs/reference/runtime-api.md`](./docs/reference/runtime-api.md) — shipped contracts (update with code changes) |
| **Example apps** | [`docs/building-apps/example-apps.md`](./docs/building-apps/example-apps.md) · [`projects/`](./projects/README.md) |

---

## Install & run

Requires **Node.js 22+** and **Yarn 1.x**.

### 1. Clone and build

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build    # framework → dist/
yarn test     # optional verify
```

### 2. Add your project

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
    "@guidify-ai/vapi-studio": "file:.."
  }
}
```

```bash
cd projects/my-voice-app
yarn install
docker compose up --build
```

Wire `VapiStudioModule`, `config/flow.yaml`, and Vapi routes in the project. See [`projects/README.md`](./projects/README.md) · [Creating an app](./docs/building-apps/creating-an-app.md) · [Installation](./docs/getting-started/installation.md).

After framework changes: `yarn build` at the repo root, then reinstall in the project if needed.

---

## License

[MIT](./LICENSE)
