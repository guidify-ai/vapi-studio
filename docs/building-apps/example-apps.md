# Example applications

Examples are **NestJS projects under `projects/`** — same clone as the framework. They are not shipped in `src/`; copy or clone them into your `projects/` folder.

| Example | How to get it |
| --- | --- |
| **roofr-poc** | Integration PoC — Vapi inbound, Flow Studio, forms, multi-lane intake. Clone or copy into `projects/roofr-poc/` (see [guidify-ai/roofr-poc](https://github.com/guidify-ai/roofr-poc) if hosted separately). |

```json
// projects/<example>/package.json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:../.."
  }
}
```

## What to copy

- `VapiStudioModule.forRoot` wiring
- Vapi webhook + Custom LLM controller shape
- `flow.yaml` structure and portal nodes
- Docker + **ngrok** local dev loop — `yarn start` tunnels localhost to HTTPS and prints Webhook + Conversation URLs for Vapi

## What stays in the framework

Supervisor, adapters, forms service, persistence entities, standard intentions — consumed from the repo root package, not copied.
