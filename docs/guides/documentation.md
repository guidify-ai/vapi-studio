# Documentation layers

Where truth lives. Update the matching layer in the **same change** as the code.

| Layer | Location | Update when |
| --- | --- | --- |
| **Doc site index** | `docs/README.md` | New top-level doc section or nav change |
| **Getting started** | `docs/getting-started/` | Install path, quick start, requirements |
| **Entry README** | `README.md` | Product intro, tools table, diagram, install path |
| **Projects guide** | `projects/README.md` | How `projects/` works |
| **Building apps** | `docs/building-apps/` | Scaffold apps under `projects/` |
| **Example apps** | `docs/building-apps/example-apps.md` | Example projects in `projects/` |
| **Runtime reference** | `docs/reference/runtime-api.md` | Shipped framework behavior / export / env |
| **Best practices** | `docs/best-practices/` | Conversation doctrine |
| **Agent entry** | `agent/AGENTS.md` | Install pointers or guide index |
| **App northern stars** | `projects/<app>/README.md` | Goals, triggers — no flow dumps |

## Do not

- Dump flow YAML, node graphs, or extract schemas into framework READMEs
- Put customer-specific agent steps into `src/` or best-practice guides
- Leave docs for a follow-up PR when behavior already shipped

## Doc site vs runtime reference

- **`docs/`** — navigation, onboarding, building-apps guides
- **`docs/reference/runtime-api.md`** — shipped contracts (update with code)
- **`README.md`** — entry index only

## Cursor enforcement

Projects get `.cursor/rules/vapi-studio-best-practices.mdc` from postinstall.

See also [Agents & Cursor](./agents.md).
