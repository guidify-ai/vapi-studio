# Agents & coding CLIs

Guidify AI is built to be **agent-friendly**: one handbook, stamped refs, and always-on rules for Cursor and Claude Code.

## Shared handbook

| Resource | Purpose |
| --- | --- |
| [`agent/AGENTS.md`](../../agent/AGENTS.md) | Canonical doctrine (tool-agnostic) |
| [`docs/best-practices/README.md`](../best-practices/README.md) | Which doctrine guide to open |
| App `AGENTS.md` | Stamped block from package postinstall |

Claude Code does **not** auto-read `AGENTS.md`. Keep the handbook under `agent/` (`AGENTS.md` + `CLAUDE.md`); put a one-line root `CLAUDE.md` that `@agent/CLAUDE.md` so Claude Code discovers it (Anthropic’s documented pattern).

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
| `.claude/rules/` | Mirrors framework `.cursor/rules/` (docs layers, runtime-api hard rule, agent steps, identity, best practices) |
| `.claude/skills/speckit-*` | Symlinks to `.cursor/skills/speckit-*` (same SpecKit workflows) |
| `agent/claude/rules/*.md` | Templates copied into **app** `.claude/rules/` on postinstall |
| App `CLAUDE.md` | Stamped import of package `agent/AGENTS.md` |

| Cursor rule (`.cursor/rules/`) | Claude rule (`.claude/rules/`) |
| --- | --- |
| `documentation-layers.mdc` | `documentation-layers.md` |
| `vapi-studio-framework-docs.mdc` | `vapi-studio-framework-docs.md` |
| `vapi-studio-agent-steps.mdc` | `vapi-studio-agent-steps.md` |
| `vapi-studio-best-practices.mdc` | `vapi-studio-best-practices.md` |
| `ui-and-api-identity.mdc` | `ui-and-api-identity.md` |

## Workspace Cursor rules (framework repo)

| Rule | Scope | Enforces |
| --- | --- | --- |
| `documentation-layers.mdc` | always | Update correct README / doc layer |
| `vapi-studio-framework-docs.mdc` | framework | Handbook + best practices in sync |
| `vapi-studio-best-practices.mdc` | apps (postinstall) | One CTA, PII, forensics |
| `ui-and-api-identity.mdc` | always | External `uuid`, BE `id`+`uuid`, DTO `label` |
| `vapi-studio-agent-steps.mdc` | agent steps, flow.yaml | Intention naming, Brain SLOs, lifecycle order |

See [Node conventions](./node-conventions.md) for a human summary of agent-step rules.

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

Refreshes:

- `.cursor/rules/vapi-studio-best-practices.mdc` + `ui-and-api-identity.mdc`
- `.claude/rules/vapi-studio-best-practices.md` + `ui-and-api-identity.md`
- stamped blocks in app `AGENTS.md` and `CLAUDE.md`

Does not wipe custom sections outside the stamped markers.

## SpecKit

Greenfield features: [SpecKit guide](./speckit.md).

## Related

- [Documentation layers](./documentation.md)
