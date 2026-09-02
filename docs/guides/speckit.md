# SpecKit

Workspace tooling for specify → plan → tasks → implement workflows under `specs/`.

## Skills (`.cursor/skills/`)

| Skill | Use |
| --- | --- |
| `speckit-specify` | Create/update feature spec from description |
| `speckit-clarify` | Targeted clarification questions → spec |
| `speckit-plan` | Generate plan from spec template |
| `speckit-tasks` | Generate `tasks.md` from plan |
| `speckit-analyze` | Cross-artifact consistency check |
| `speckit-checklist` | Custom checklist from requirements |
| `speckit-implement` | Execute tasks from `tasks.md` |
| `speckit-converge` | Find unbuilt work → append tasks |
| `speckit-constitution` | Update constitution |
| `speckit-taskstoissues` | Convert tasks to GitHub issues |

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
| Compliance check | `speckit-analyze` after tasks |

## Historical artifacts

Completed PoC: [specs/001-ra9-vapi-poc](../reference/historical-specs.md) — may lag shipped code.

**Authority:** `vapi-studio/README.md` and `docs/` over SpecKit contracts.

## Related

- [Constitution](../reference/principles.md)
- [Documentation layers](./documentation.md)
