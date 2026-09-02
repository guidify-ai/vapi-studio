# Installation

## Requirements

- **Node.js 22+**
- **Yarn 1.x**

Docker, ngrok, and Vapi are configured in **`projects/<your-app>/`**, not in the framework root.

## Clone and build

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build
```

## Verify

```bash
yarn test
```

## Your project under `projects/`

```bash
mkdir -p projects/my-voice-app
cd projects/my-voice-app
```

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:.."
  }
}
```

`file:..` is the framework at the **repository root** (one level up from `projects/<name>/`).

After framework changes: `yarn build` at the repo root, then `yarn install` in the project if needed.

A private npm registry is optional for teams that split repos later; the default is one clone with `projects/`.

## Agent refs in projects

When your project runs `yarn install`, postinstall copies:

- `.cursor/rules/vapi-studio-best-practices.mdc`
- `AGENTS.md` block

Manual refresh: `INIT_CWD=$PWD node node_modules/@guidify-ai/vapi-studio/scripts/install-agent-refs.cjs`

Next: [Quick start](./quick-start.md) · [`projects/README.md`](../../projects/README.md)
