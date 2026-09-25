# Building applications — overview

**[@guidify-ai/vapi-studio](https://www.npmjs.com/package/@guidify-ai/vapi-studio)** is an npm library. Your bot is a NestJS app that depends on it.

**Start every new bot by cloning [vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project)** — then rename, set `PROJECT_NAME`, and extend nodes / `flow.yaml`.

```text
my-bot/                         ← clone of vapi-studio-project
├── package.json                ← "@guidify-ai/vapi-studio": "0.1.0"
├── config/
│   ├── project.identity.json   ← name + slug (from .env)
│   └── flow.yaml
├── src/
│   ├── conversation/           ← your agent steps
│   └── vapi/                   ← /vapi/webhook + /vapi/chat/completions
└── docker-compose.yaml
```

| Repo | Role |
| --- | --- |
| [vapi-studio](https://github.com/guidify-ai/vapi-studio) | Framework → npm `@guidify-ai/vapi-studio` |
| [vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project) | **Starter** — fork this to ship a bot |
| [vapi-studio-landing-page-sample-model](https://github.com/guidify-ai/vapi-studio-landing-page-sample-model) | Showcase (Planner LLM) — study patterns, not a blank template |

Do not add customer-specific agent steps under the framework `src/` — only in your starter fork.

[Creating an app](./creating-an-app.md) · [Example apps](./example-apps.md)
