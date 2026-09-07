# Vapi Studio — Claude Code

Canonical agent handbook (shared with Cursor / other agents):

@AGENTS.md

## Framework checkout

- Package source: `src/` → build with `yarn build` (output `dist/`, gitignored).
- Apps: `projects/<name>/` with `@guidify-ai/vapi-studio` via `file:../..`.
- Contracts: `docs/reference/runtime-api.md` (update in the same change as behavior).
- Doctrine: `docs/best-practices/`.
- Always-on / path rules: `.claude/rules/` (mirrors `.cursor/rules/`).
- SpecKit skills: `.claude/skills/speckit-*` (symlinks to `.cursor/skills/`).
- Cursor rule templates: `agent/cursor/` · Claude rule templates: `agent/claude/`.
