# Vapi Studio — Claude Code

Canonical agent handbook (shared with Cursor / other agents):

@AGENTS.md

## Framework checkout

- Package source: `src/` → build with `yarn build` (output `dist/`, gitignored).
- Consumer apps: separate NestJS repos depending on `@guidify-ai/vapi-studio` (npm).
- Contracts: `docs/reference/runtime-api.md` (update in the same change as behavior).
- Doctrine: `docs/best-practices/`.
- Cursor rule templates (copied into **apps** on postinstall): `agent/cursor/`.
- Claude rule templates (copied into **apps** on postinstall): `agent/claude/rules/`.
- SpecKit config / templates: `.specify/` (see `docs/guides/speckit.md`).
- Architecture decisions: `docs/ards/` (required for architectural PRs — `CONTRIBUTING.md`).
- Constitution (framework only): `.specify/memory/constitution.md`.
