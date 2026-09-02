# Projects

Your Vapi bots live here — inside the same clone as the framework.

```text
vapi-studio/
├── src/                  ← framework (do not put product code here)
├── docs/
└── projects/
    └── my-voice-app/     ← your NestJS app (Docker, flow.yaml, Vapi routes)
```

## Create a project

```bash
# from repo root, after yarn install && yarn build
mkdir -p projects/my-voice-app
cd projects/my-voice-app
# scaffold NestJS app, then in package.json:
```

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:.."
  }
}
```

```bash
yarn install
docker compose up --build   # or your app's run command
```

After framework changes: `yarn build` at the repo root, then reinstall in the project if needed.

## What goes in a project

- `config/flow.yaml`, agent steps, copy, `.env`, Docker
- `README.md` with northern stars only (no flow dumps)

Framework mechanics stay in the repo root (`src/`, `docs/`). See [Creating an app](../docs/building-apps/creating-an-app.md).

## Examples

Copy patterns from [example apps](../docs/building-apps/example-apps.md). A full PoC may live at `projects/roofr-poc/` locally (gitignored by default).

## Separate git repo (optional)

Teams that need a dedicated repository can still publish or clone a project elsewhere and depend on `@guidify-ai/vapi-studio` from npm or `file:../vapi-studio`. The default path is **`projects/` in this clone**.
