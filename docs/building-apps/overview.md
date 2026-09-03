# Building applications — overview

Vapi Studio is a **toolkit** in the repo root. Your bot is a **NestJS application** under **`projects/`** in the same clone.

## Layout

```text
vapi-studio/                    ← one git clone
├── src/                        ← framework package (@guidify-ai/vapi-studio)
├── docs/
└── projects/
    └── my-voice-app/           ← your bot
        ├── package.json        ← "file:../.." → repo root
        ├── config/flow.yaml
        ├── docker-compose.yml
        └── src/
            ├── conversation/   agent steps, copy
            └── vapi/           webhooks, Custom LLM
```

No second folder beside the clone. No dedicated app repository required.

## Separation

| Repo root (framework) | `projects/<your-app>/` |
| --- | --- |
| `VapiStudioModule`, supervisor, adapters | `flow.yaml`, agent steps, copy |
| Standard intentions, forms API | Domain intentions, CRM, forms UI |
| Vapi SSE compiler | `POST /{projectUuid}/vapi/webhook`, Custom LLM routes |
| Event driver, persistence entities | `.env`, Docker, Vapi dashboard config |
| Best-practice doctrine | Project `README.md` (northern stars) |

Do not add customer-specific agent steps or copy under `src/` — only under `projects/`.

## Dependency

```json
"@guidify-ai/vapi-studio": "file:../.."
```

Path is **two levels up** from `projects/<name>/` to the framework root (`projects/<name>` → `projects/` → repo root).

## Next

[Creating an app](./creating-an-app.md) · [Example apps](./example-apps.md) · [`projects/README.md`](../../projects/README.md)
