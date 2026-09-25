# Contributing to Vapi Studio

Thanks for contributing to **`@guidify-ai/vapi-studio`** (framework only).

## What belongs here

| In this repo | Not in this repo |
| --- | --- |
| Runtime, adapters, persistence, Studio UI package bits | Customer bot flows / copy |
| Public docs + ARDs | Commercial product roadmap / private strategy |
| SpecKit for **framework** features | App-only Nest projects (use the starter) |

## Pull requests

1. **Branch** from `master` (or `develop` if that is the active integration branch).
2. **Tests:** `yarn test` must pass.
3. **Docs:** update `docs/reference/runtime-api.md` (and best-practices if doctrine changes) in the same PR.
4. **ARDs (required for architecture):** if the change affects public API, Supervisor/Brain/listen behavior, persistence, or adapters, add or update an entry under [`docs/ards/`](./docs/ards/README.md) using [`.specify/templates/ard-template.md`](./.specify/templates/ard-template.md). Link the ARD in the PR body.
5. **SpecKit (recommended for larger work):** use [`.specify/`](./.specify/) — see [`docs/guides/speckit.md`](./docs/guides/speckit.md). Specs describe the framework change; they must not encode private product strategy.
6. **Constitution:** PRs must not violate [`.specify/memory/constitution.md`](./.specify/memory/constitution.md).

## Secrets & IP

- Never commit API keys, tokens, or private customer data.
- Do not paste internal commercial strategy, customer names, or private roadmaps into SpecKit artifacts or ARDs. Framework rationale only.

## Dependencies

Prefer **exact versions** (no `^` / `~`) for Nest and other peers — major Nest upgrades
are intentional release work, not drive-by installs.

| Field | Policy |
| --- | --- |
| `peerDependencies` | Exact versions apps must match (`twilio` optional) |
| `dependencies` | Exact (`uuid`, `yaml`) |
| `devDependencies` | Same Nest/peer pins as peers for this package’s build |

Bump peers only in a deliberate PR (+ ARD if the upgrade changes supported app contracts).

## Local setup

```bash
yarn install
yarn build
yarn test
```
