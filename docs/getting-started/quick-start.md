# Quick start

## 1. Clone, build, test

```bash
git clone git@github.com:guidify-ai/vapi-studio.git
cd vapi-studio
yarn install
yarn build
yarn test
```

## 2. Create a project

```bash
mkdir -p projects/my-voice-app
cd projects/my-voice-app
```

Add to `package.json`:

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:../.."
  }
}
```

## 3. Minimal Nest wiring

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

## 4. Run and wire Vapi

Install **[ngrok](https://ngrok.com/download)** if you have not already. Local dev tunnels Docker (`localhost:9999` in example apps) to HTTPS — Vapi cannot call localhost directly.

```bash
yarn install
yarn start   # Docker + ngrok; keeps tunnel open until Ctrl+C
```

`yarn start` prints **Webhook** and **Conversation** URLs on the ngrok origin. Paste them into your Vapi assistant before testing a call. Restart `yarn start` when you need a fresh tunnel URL (or use an ngrok reserved domain).

## 5. Read next

| Topic | Doc |
| --- | --- |
| Projects folder | [`projects/README.md`](../../projects/README.md) |
| Module options | [Module setup](../guide/module-setup.md) |
| Mental model | [Concepts](../guide/concepts.md) |
| Runtime API | [runtime-api.md](../reference/runtime-api.md) |
| Examples | [Example apps](../building-apps/example-apps.md) |
