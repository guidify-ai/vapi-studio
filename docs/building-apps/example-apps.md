# Example applications

## Starter (start here)

**[vapi-studio-project](https://github.com/guidify-ai/vapi-studio-project)** — blank Nest shell for a new bot.

```bash
git clone git@github.com:guidify-ai/vapi-studio-project.git my-bot
cd my-bot && cp .env.example .env
# Edit PROJECT_NAME=…
yarn install && yarn start
```

Surface after `yarn start`:

- Operator SPA: `/flow`, `/conversations`
- Ingress: `/vapi/webhook`, `/vapi/chat/completions` (host-scoped)

Step-by-step: [Creating an app](./creating-an-app.md).

## Showcase (reference implementation)

**[vapi-studio-landing-page-sample-model](https://github.com/guidify-ai/vapi-studio-landing-page-sample-model)** — Planner LLM demo (not a blank starter). Depends on `@guidify-ai/vapi-studio@0.1.1` (or `file:../vapi-studio` while developing the next package version). Use it to see richer Vapi strategies, funnels, and multi-node flows.
