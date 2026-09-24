# Documentation layers

**Repo:** [guidify-ai/vapi-studio](https://github.com/guidify-ai/vapi-studio) — framework package only. Apps are separate repos that depend on `@guidify-ai/vapi-studio`.

## Layers

1. **`README.md`** — product intro, tools, install path
2. **`docs/`** — documentation site (`docs/README.md`)
3. **`docs/reference/runtime-api.md`** — shipped runtime contracts (update with code)
4. **`docs/best-practices/`** — conversation doctrine
5. **`docs/building-apps/`** — how apps consume the package
6. **App README** (your repo) — northern stars only

Apps get `AGENTS.md` + `CLAUDE.md` + `.cursor/rules/*` + `.claude/rules/*` from `@guidify-ai/vapi-studio` postinstall.
