# Architecture Decision Records (ARDs)

Framework-only decisions for `@guidify-ai/vapi-studio`.

Consumer bots do **not** put product strategy here — only changes that affect
the published package contract, runtime, adapters, or docs structure.

## When an ARD is required

Open or update an ARD for PRs that:

- Change public TypeScript exports / Nest module wiring
- Alter Supervisor / Brain / listen / portal behavior
- Change persistence schema or Conversation lifecycle
- Add or reshape provider adapters (Vapi, forms dispose, …)
- Change documented contracts in `docs/reference/`

**Not required** for typo fixes, test-only cleanups, or doc wording that does
not change behavior — unless reviewers ask for one.

## Process

1. Copy [`.specify/templates/ard-template.md`](../../.specify/templates/ard-template.md)
   to `docs/ards/ARD-XXXX-<slug>.md` (next free number).
2. Fill **Context / Decision / Consequences** before or with the implementation PR.
3. Reference the ARD in the PR description.
4. Prefer SpecKit (`.specify/`) for larger greenfield work — still end with an ARD
   when the outcome is architectural.

## Index

| ARD | Title | Status |
| --- | --- | --- |
| [ARD-0001](./ARD-0001-host-scoped-vapi-ingress.md) | Host-scoped Vapi ingress (no project UUID in path) | Accepted |

Constitution: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)  
Contributing: [CONTRIBUTING.md](../../CONTRIBUTING.md)
