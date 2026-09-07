# Agents

Project-specific agent notes for this app.

<!-- VAPI-STUDIO-BEST-PRACTICES:BEGIN -->
## Vapi Studio best practices

This app depends on `@guidify-ai/vapi-studio`. CLI / coding agents **must** read the
framework best-practice guides before changing conversation copy, agent steps,
listens, extracts, or identity flows:

- `node_modules/@guidify-ai/vapi-studio/docs/best-practices/README.md`
- `node_modules/@guidify-ai/vapi-studio/agent/AGENTS.md`
- Cursor rule: `.cursor/rules/vapi-studio-best-practices.mdc` (installed with the package)
- Cursor rule: `.cursor/rules/ui-and-api-identity.mdc` (UUID externally; `id`+`uuid` in DB; human `label`)
- Claude Code: `CLAUDE.md` + `.claude/rules/` (same doctrine; installed with the package)

Hard rules (summary): **one CTA per turn**; conversations **must end** (limits always on);
constrained fields **fail closed**; short listen timeouts for digits; never store ASR junk
as PII; soft affirmatives on multi-choice → local re-ask; silent handoffs; FE uses **uuid**
only (never internal id) and DTOs include human **label**; update the matching doc layer in the
same change. Runtime contracts: `docs/reference/runtime-api.md`.
<!-- VAPI-STUDIO-BEST-PRACTICES:END -->

