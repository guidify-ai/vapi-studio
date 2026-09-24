# Building applications — overview

Vapi Studio is an **npm library**. Your bot is a **NestJS application** in its own repo (or folder) that depends on `@guidify-ai/vapi-studio`.

```text
my-voice-app/                 ← your app (private or public)
├── package.json              ← "@guidify-ai/vapi-studio": "0.1.0"
├── src/
├── config/flow.yaml
└── docker-compose.stub.yaml
```

| Package | App |
| --- | --- |
| `@guidify-ai/vapi-studio` (this repo / npm) | Your NestJS voice bot |
| Types, Supervisor, Brain adapters, Studio UI assets | Nodes, flow.yaml, Vapi routes, secrets |

Do not add customer-specific agent steps under the framework `src/` — only in your app.

Public showcase: [vapi-studio-sample-landing-llm](https://github.com/guidify-ai/vapi-studio-sample-landing-llm).

[Creating an app](./creating-an-app.md) · [Example apps](./example-apps.md)
