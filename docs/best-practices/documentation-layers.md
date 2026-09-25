# Documentation layers

Where truth lives. Agents must update the matching layer in the **same** change as the code.

| Layer | Location | Update when |
| --- | --- | --- |
| Doc site index | `docs/README.md` | New doc section or navigation |
| Repository README | `README.md` (package root) | Clone URL, fast start, framework scope |
| Framework handbook | `docs/reference/runtime-api.md` | Any shipped Vapi Studio behavior / export / env change |
| Best practices | `docs/best-practices/` | Doctrine for conversation design / nodes / PII / forensics |
| Agent entry | `agent/AGENTS.md` + `agent/cursor/` / `agent/claude/rules/` (stamped into consumer apps) | Install pointer text or guide index changes |
| Building apps | `docs/building-apps/` | How to clone [vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project) and extend it |
| Example apps | `docs/building-apps/example-apps.md` | Starter + showcase repo links |

Application northern stars live in **your app’s README** — not in framework `src/`.

## Do not

- Dump flow YAML, node graphs, or extract schemas into framework READMEs.
- Put customer- or PoC-specific nodes into the handbook or these guides — use generic examples only.
- Ship application source or runbooks in the framework repository.
- Leave docs for a “follow-up” PR when behavior already shipped.

## Consumer projects

Installing `@guidify-ai/vapi-studio` runs `scripts/install-agent-refs.cjs`, which ensures the app has:

- `.cursor/rules/vapi-studio-best-practices.mdc`
- `AGENTS.md` — stamped Vapi Studio block

Re-running install refreshes the managed rule file; it does not wipe custom sections outside the stamped `AGENTS.md` block.
