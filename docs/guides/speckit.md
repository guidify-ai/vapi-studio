# SpecKit

Workspace tooling for specify → plan → tasks → implement workflows under `specs/`.

Config, templates, and scripts live under **`.specify/`** (not under framework-local `.cursor/` — that tree was removed from this package).

## Workflows

| Workflow | Use |
| --- | --- |
| specify | Create/update feature spec from description |
| clarify | Targeted clarification questions → spec |
| plan | Generate plan from spec template |
| tasks | Generate `tasks.md` from plan |
| analyze | Cross-artifact consistency check |
| checklist | Custom checklist from requirements |
| implement | Execute tasks from `tasks.md` |
| converge | Find unbuilt work → append tasks |
| constitution | Update constitution |
| taskstoissues | Convert tasks to GitHub issues |

Invoke via SpecKit / Specify CLI against `.specify/` (see `.specify/workflows/`, `.specify/templates/`). IDE skills (`.cursor/skills/speckit-*`, `.claude/skills/speckit-*`) are **not** shipped in this framework package — SpecKit here is `.specify/` only. Reinstall SpecKit skills into a local checkout if you need IDE skill discovery.

## Artifact layout

```text
specs/<feature-id>/
├── spec.md
├── plan.md
├── tasks.md
├── research.md
├── quickstart.md
├── data-model.md
└── contracts/
```

Templates: `.specify/templates/`

## When to use SpecKit vs best practices

| Work | Start here |
| --- | --- |
| Day-to-day bot nodes / copy | [Best practices](../best-practices/README.md) + [Agents](./agents.md) |
| Greenfield framework feature | SpecKit specify → plan → tasks |
| Compliance check | SpecKit analyze after tasks |

## Historical artifacts

Older SpecKit PoC dumps may exist under a local `archive/` folder (gitignored — not in the repo). Prefer current `docs/` and `docs/reference/runtime-api.md`.

**Authority:** root `README.md` and `docs/` over SpecKit contracts.

## Related

- [Constitution](../reference/principles.md)
- [Documentation layers](./documentation.md)
