# Agents & Cursor

Guidify AI is built to be **agent-friendly**: conventions, stamped refs, and always-on rules.

## Agent entry points

| Resource | Purpose |
| --- | --- |
| [`agent/AGENTS.md`](../../agent/AGENTS.md) | Framework agent handbook |
| [`docs/best-practices/README.md`](../best-practices/README.md) | Which doctrine guide to open |
| App `AGENTS.md` | Stamped block from package postinstall |
| `.cursor/rules/vapi-studio-best-practices.mdc` | Always-on conversation rules (apps) |

## Workspace Cursor rules

| Rule | Scope | Enforces |
| --- | --- | --- |
| `documentation-layers.mdc` | always | Update correct README / doc layer |
| `vapi-studio-framework-docs.mdc` | framework | Handbook + best practices in sync |
| `vapi-studio-best-practices.mdc` | apps (postinstall) | One CTA, PII, forensics |
| `vapi-studio-agent-steps.mdc` | agent steps, flow.yaml | Intention naming, Brain SLOs, lifecycle order |

See [Node conventions](./node-conventions.md) for a human summary of agent-step rules.

## Recommended workflow

1. Read app **northern stars** (app repo `README.md`).
2. Read `AGENTS.md` (app or package).
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
| Analytics funnels / tags | debugging-and-observability.md · events-and-logging.md |
| Logs / events | debugging-and-observability.md |
| Limits / public API / env | [Runtime API](../reference/runtime-api.md) |
| README placement | documentation-layers.md |

## Postinstall

```bash
INIT_CWD=$PWD node node_modules/@guidify-ai/vapi-studio/scripts/install-agent-refs.cjs
```

Refreshes `.cursor/rules/vapi-studio-best-practices.mdc` without wiping custom `AGENTS.md` sections.

## SpecKit

Greenfield features: [SpecKit guide](./speckit.md).

## Related

- [Documentation layers](./documentation.md)
