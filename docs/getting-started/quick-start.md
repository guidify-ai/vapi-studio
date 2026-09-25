# Quick start

Clone the public starter, name the project, run it.

```bash
git clone git@github.com:guidify-ai/vapi-studio-project.git my-bot
cd my-bot
cp .env.example .env
# Edit PROJECT_NAME=…  (PROJECT_SLUG optional)
yarn install
yarn start   # Docker + Postgres + ngrok → prints Vapi URLs
```

Paste into your Vapi assistant:

| Setting | URL |
| --- | --- |
| Webhook | `{PUBLIC_BASE_URL}/vapi/webhook` |
| Custom LLM | `{PUBLIC_BASE_URL}/vapi/chat/completions` |

Then extend `src/conversation/` and `config/flow.yaml`. Full walkthrough: [Creating an app](../building-apps/creating-an-app.md).

Framework contributors (changing the library, not starting a bot): clone [vapi-studio](https://github.com/guidify-ai/vapi-studio), `yarn build`, `yarn test` — see [Installation](./installation.md).
