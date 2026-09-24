# Projects

```text
vapi-studio/                       # public GitHub + npm (@guidify-ai/vapi-studio)
├── src/                           # framework (published as dist/)
├── docs/
└── projects/
    └── sample-landing-llm/        # tracked sample bot (:9998)
```

**Your production bot is not this folder.** Install the package into **your** app (private repo), like a Laravel app depending on the framework:

```bash
yarn add @guidify-ai/vapi-studio@0.1.0
```

| Location | Role | Public? |
| --- | --- | --- |
| npm `@guidify-ai/vapi-studio` | Framework library | Yes |
| `projects/sample-landing-llm/` in this repo | Demo / reference | Yes (GitHub) |
| Your app (e.g. `roofr-poc`) | Product code + secrets | **Private** — own git remote |

## Sample (in this repo)

```bash
cd projects/sample-landing-llm && yarn start
# http://127.0.0.1:9998/flow
```

Compose: tracked `docker-compose.stub.yaml` → gitignored `docker-compose.yaml` on first start.

## Private apps

Keep private bots **outside** this repository (sibling folders or separate remotes). Point them at a **published** version once you ship:

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "0.1.0"
  }
}
```

During framework development you may temporarily use `file:../guidify-ai` or a symlink; switch to the registry version for real deploys.

Local multi-host lab (shared Postgres/Redis): sibling `guidify-lab` — not part of the npm package. See [Extending events](../docs/guides/extending-events.md).
