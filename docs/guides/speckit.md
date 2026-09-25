# SpecKit

Workspace tooling for **specify → plan → tasks → implement** on **framework**
changes. Config lives under **`.specify/`**.

Consumer bots: do not dump product strategy into this repo’s SpecKit tree.
Architectural outcomes MUST land as **ARDs** under [`docs/ards/`](../ards/README.md).

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
| constitution | Update [constitution](../../.specify/memory/constitution.md) |
| taskstoissues | Convert tasks to GitHub issues |

Invoke via SpecKit / Specify CLI against `.specify/`. IDE skills
(`.cursor/skills/speckit-*`, …) are **not** shipped in the npm package — reinstall
locally if you need IDE skill discovery.

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

Templates: `.specify/templates/` (includes **`ard-template.md`** for ARDs).

## ARDs (Architecture Decision Records)

| Rule | Detail |
| --- | --- |
| **Required** | PRs that change framework architecture / public contracts |
| **Location** | `docs/ards/ARD-XXXX-*.md` |
| **Template** | `.specify/templates/ard-template.md` |
| **Index** | [docs/ards/README.md](../ards/README.md) |

SpecKit produces working artifacts; the **ARD** is the durable, reviewable
decision for OSS history. Link SpecKit folders from the ARD when both exist.

## When to use SpecKit vs best practices

| Work | Start here |
| --- | --- |
| Day-to-day bot nodes (in an **app** repo) | App best practices + package `docs/best-practices/` |
| Greenfield **framework** feature | SpecKit specify → plan → tasks → **ARD** |
| Compliance check | SpecKit analyze + constitution |

## Authority

1. [Constitution](../../.specify/memory/constitution.md)  
2. Shipped [`docs/`](../README.md) + [`docs/reference/runtime-api.md`](../reference/runtime-api.md)  
3. SpecKit feature folders (ephemeral relative to the above)

## Related

- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [Documentation map](./documentation.md)
