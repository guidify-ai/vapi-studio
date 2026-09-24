# Quick start

## App from npm (recommended)

```bash
mkdir my-voice-app && cd my-voice-app
yarn init -y
yarn add @guidify-ai/vapi-studio @nestjs/common @nestjs/core @nestjs/typeorm \
  reflect-metadata rxjs typeorm
```

Or copy the tracked sample from the [GitHub repo](https://github.com/guidify-ai/vapi-studio/tree/main/projects/sample-landing-llm) and change the dependency to:

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "0.1.0"
  }
}
```

## Minimal Nest wiring

```typescript
import { Module } from '@nestjs/common';
import { VapiStudioModule, ChatGptBrainAdapter } from '@guidify-ai/vapi-studio';
import { GreetNode } from './conversation/nodes/greet.node';
import { MyEntry } from './conversation/entry';

@Module({
  imports: [
    VapiStudioModule.forRoot({
      entryPoint: MyEntry,
      brainAdapter: ChatGptBrainAdapter,
      brain: { model: 'gpt-4.1-mini', confidenceThreshold: 0.4 },
      // limits always on (defaults 40 turns / 20m); override only within ceilings
      nodes: [{ className: 'GreetNode', useClass: GreetNode }],
    }),
  ],
})
export class AppModule {}
```

Add `config/flow.yaml` with `start: greet` and Vapi HTTP routes — see [Creating an app](../building-apps/creating-an-app.md).

## Run and wire Vapi

Install **[ngrok](https://ngrok.com/download)** if you have not already. Local dev tunnels Docker to HTTPS — Vapi cannot call localhost directly.

```bash
yarn install
yarn start   # Docker + ngrok; keeps tunnel open until Ctrl+C
```

Paste the printed **Webhook** and **Conversation** URLs into your Vapi assistant. Keep the process running while you test calls.

## Framework contributors only

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install && yarn build && yarn test
cd projects/sample-landing-llm && yarn start
```

In-repo apps may use `"@guidify-ai/vapi-studio": "file:../.."`. Production / private apps should pin the published package.

Full install notes: [Installation](./installation.md).
