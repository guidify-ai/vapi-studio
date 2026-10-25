# Contributing to Vapi Studio

Thanks for contributing to **`@guidify-ai/vapi-studio`** (framework only).

## North Star

**Vapi Studio is a toolkit for building on [Vapi](https://vapi.ai).** Vapi is
required, not one channel among many. Before opening a PR, ask: *does this make
building on Vapi better?* If the change makes Studio work without Vapi, or makes
Vapi swappable for another platform, it will be declined.
See the [constitution](./.specify/memory/constitution.md#north-star) and
[ARD-0002](./docs/ards/ARD-0002-vapi-only-north-star.md).

## What belongs here

| In this repo | Not in this repo |
| --- | --- |
| Runtime, adapters, persistence, Studio UI package bits | Customer bot flows / copy |
| Public docs + ARDs | Commercial product roadmap / private strategy |
| SpecKit for **framework** features | App-only Nest projects (use the starter) |
| Vapi features and companion surfaces that serve a Vapi call (SMS form links, analytics, CRM hooks) | Adapters for other voice/agent platforms (Twilio Voice, Retell, Bland, LiveKit, …) or a provider-agnostic layer |

## Pull requests

1. **Branch** from `develop` and open the PR into `develop`. Only release PRs go `develop` → `master`.
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

## Releases

See [ARD-0005](./docs/ards/ARD-0005-release-flow.md). In short:

1. `develop` carries the next version; nothing is published from it.
2. Maintainer-owned apps switch to `file:../vapi-studio`, adapt, and pass their checks.
3. Maintainer signs off with real calls on the reference apps — then the release is **ready**.
4. `develop` → `master` PR, tag `vX.Y.Z` on master, `npm publish` from the tag.
5. Apps switch to the exact published version right away.

Every release has an article in [`docs/releases/`](./docs/releases/README.md)
([ARD-0007](./docs/ards/ARD-0007-release-articles.md)). **Feature PRs add their
section to the upcoming article** — what, **why**, trade-offs, reference. A
feature without reasoning does not ship.

## Local setup

```bash
yarn install
yarn build
yarn test
```
