# Quick start

```bash
mkdir my-voice-app && cd my-voice-app
yarn init -y
yarn add @guidify-ai/vapi-studio@0.1.0 @nestjs/common @nestjs/core @nestjs/typeorm \
  reflect-metadata rxjs typeorm
```

Or clone the public sample and study its layout:

- [vapi-studio-sample-landing-llm](https://github.com/guidify-ai/vapi-studio-sample-landing-llm)

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
      nodes: [{ className: 'GreetNode', useClass: GreetNode }],
    }),
  ],
})
export class AppModule {}
```

Add `config/flow.yaml` with `start: greet` and Vapi HTTP routes — see [Creating an app](../building-apps/creating-an-app.md).

## Run and wire Vapi

```bash
yarn start   # Docker + ngrok (see the sample’s scripts/start.sh)
```

Paste the printed **Webhook** and **Conversation** URLs into your Vapi assistant.

Framework contributors: `git clone` this repo, `yarn build`, `yarn test`. Full notes: [Installation](./installation.md).
