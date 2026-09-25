# Agents & coding CLIs

Guidify AI is built to be **agent-friendly**: one handbook, stamped refs, and always-on rules for Cursor and Claude Code.

## Shared handbook

| Resource | Purpose |
| --- | --- |
| [`agent/AGENTS.md`](../../agent/AGENTS.md) | Canonical doctrine (tool-agnostic) |
| [`docs/best-practices/README.md`](../best-practices/README.md) | Which doctrine guide to open |
| App `AGENTS.md` | Stamped block from package postinstall |

Claude Code does **not** auto-read `AGENTS.md`. Keep the handbook under `agent/` (`AGENTS.md` + `CLAUDE.md`); put a one-line root `CLAUDE.md` that `@agent/CLAUDE.md` so Claude Code discovers it (Anthropic’s documented pattern).

This framework package does **not** keep always-on rules under `.cursor/` or `.claude/` in-repo. Edit templates under `agent/`; postinstall copies them into **consumer apps**.

## Cursor

| Resource | Purpose |
| --- | --- |
| `agent/cursor/*.mdc` | Templates copied into app `.cursor/rules/` |
| App `.cursor/rules/vapi-studio-best-practices.mdc` | Always-on conversation rules |
| App `.cursor/rules/ui-and-api-identity.mdc` | UUID / label identity |

## Claude Code CLI

| Resource | Purpose |
| --- | --- |
| Repo [`agent/CLAUDE.md`](../../agent/CLAUDE.md) | Framework Claude notes (`@AGENTS.md`); root `CLAUDE.md` is discovery-only |
| `agent/claude/rules/*.md` | Templates copied into **app** `.claude/rules/` on postinstall |
| App `.claude/rules/vapi-studio-best-practices.md` | Always-on conversation rules |
| App `.claude/rules/ui-and-api-identity.md` | UUID / label identity |
| App `CLAUDE.md` | Stamped import of package `agent/AGENTS.md` |

| Cursor template (`agent/cursor/`) | Claude template (`agent/claude/rules/`) |
| --- | --- |
| `vapi-studio-best-practices.mdc` | `vapi-studio-best-practices.md` |
| `ui-and-api-identity.mdc` | `ui-and-api-identity.md` |

See [Node conventions](./node-conventions.md) for agent-step naming and lifecycle order (doctrine in [nodes-and-listens.md](../best-practices/nodes-and-listens.md)).

## Recommended workflow

1. Read app **northern stars** (app repo `README.md`).
2. Read `agent/AGENTS.md` / `agent/CLAUDE.md` (app: stamped `AGENTS.md` / `CLAUDE.md`).
3. Open matching [best-practice guide](../best-practices/README.md).
4. Framework changes → [Runtime API](../reference/runtime-api.md) first.
5. Update docs in the **same PR** as behavior.

## Decision tree: which guide?

| Changing… | Read |
| --- | --- |
| Bot copy / CTA | conversation-design.md |
| Soft affirmatives / silent handoffs / lane choice | conversation-design.md (+ nodes-and-listens.md) |
| Mad callers (one re-engage → human) | nodes-and-listens.md · conversation-design.md |
| New agent step / listen / extract | nodes-and-listens.md |
| Phone, email, forms | identity-and-pii.md |
| Studio FE / Nest DTO identity | ui-and-api-identity.md |
| Analytics funnels / tags | debugging-and-observability.md · events-and-logging.md |
| Logs / events | debugging-and-observability.md |
| Limits / public API / env | [Runtime API](../reference/runtime-api.md) |
| README placement | documentation-layers.md |

## Postinstall

```bash
INIT_CWD=$PWD node node_modules/@guidify-ai/vapi-studio/scripts/install-agent-refs.cjs
```

Refreshes **in the consumer app**:

- `.cursor/rules/vapi-studio-best-practices.mdc` + `ui-and-api-identity.mdc`
- `.claude/rules/vapi-studio-best-practices.md` + `ui-and-api-identity.md`
- stamped blocks in app `AGENTS.md` and `CLAUDE.md`

Sources: `agent/cursor/` and `agent/claude/rules/` inside the package. Does not wipe custom sections outside the stamped markers.

## SpecKit

Greenfield features: [SpecKit guide](./speckit.md) (`.specify/` in this repo) + [ARDs](../ards/README.md) for architectural PRs.

## Related

- [Documentation layers](./documentation.md)
