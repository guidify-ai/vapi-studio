# Documentation layers

Where truth lives. Agents must update the matching layer in the **same** change as the code.

| Layer | Location | Update when |
| --- | --- | --- |
| Doc site index | `docs/README.md` | New doc section or navigation |
| Repository README | `README.md` (package root) | Clone URL, fast start, framework scope |
| Framework handbook | `docs/reference/runtime-api.md` | Any shipped Vapi Studio behavior / export / env change |
| Entry README | `README.md` (package root) | Product intro, tools table, diagram, link targets |
| Best practices (this folder) | `docs/best-practices/` | Doctrine for conversation design / nodes / PII / forensics |
| Agent entry | `agent/AGENTS.md` + consumer `AGENTS.md` / `.cursor/rules` | Install pointer text or guide index changes |
| Building apps | `docs/building-apps/` | How to scaffold external NestJS apps |
| Example apps | `docs/building-apps/example-apps.md` | Links to **projects/** examples |

Application northern stars live in **`projects/<app>/README.md`** — not in framework `src/`.

## Do not

- Dump flow YAML, node graphs, or extract schemas into READMEs here.
- Put customer- or PoC-specific nodes into the handbook or these guides — use generic examples only.
- Ship application source or runbooks in the framework repository.
- Leave docs for a “follow-up” PR when behavior already shipped.

## Consumer projects

Installing `@guidify-ai/vapi-studio` runs `scripts/install-agent-refs.cjs`, which ensures the app has:

- `.cursor/rules/vapi-studio-best-practices.mdc` — always-on Cursor rule pointing here
- `AGENTS.md` — stamped Vapi Studio block for any CLI agent

Re-running install refreshes the managed rule file; it does not wipe custom sections outside the stamped `AGENTS.md` block.
