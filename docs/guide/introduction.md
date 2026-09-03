# Vapi Studio — Introduction

**Vapi Studio** is Guidify AI's code-first framework for deterministic voice agents. It ships as `@guidify-ai/vapi-studio` in `vapi-studio/`.

## What it is

A NestJS module that provides:

- **Supervised conversations** — one runtime per call, durable Postgres record
- **Nodes** — `AgentNode` subclasses with `before` → `listen` → `run` → `after` → `catch`
- **Flow YAML** — start node, intentions, portals, condition transitions
- **Brain port** — mock, OpenAI, or your HTTP adapter for intention scan
- **Output port** — `say`, `sayAndListen`, `endCall`, `transferToHuman`, `handoff`, `continueTo`, `invokeAdvertisedTool`, forms
- **Vapi adapter** — OpenAI-compatible Custom LLM SSE + webhook helpers
- **Events & logs** — call forensics (`ROUTE_DECISION`, form sendout, daily files)

## What it is not

- A no-code bot builder
- A hosted SaaS
- A place for customer-specific logic — that belongs in **applications** under `projects/`

## How apps use it

```typescript
VapiStudioModule.forRoot({
  entryPoint: MyConversationEntry,
  nodes: [
    { className: 'AcknowledgeNode', useClass: AcknowledgeNode },
    { className: 'GoodbyeNode', useClass: GoodbyeNode },
  ],
  intentions: [NeedSmsPhoneIntention],
  brainAdapter: ChatGptBrainAdapter,
  brain: {
    model: 'gpt-4.1-mini',
    confidenceThreshold: 0.4,
  },
  formDisposeAdapter: LinkFormDisposeAdapter,
  eventListeners: [MyEventBuffer],
})
```

Applications own `config/flow.yaml`, node classes, variables/memory types, channel wiring, and `.env`. The framework owns orchestration contracts.

## Documentation map

| Depth | Where |
| --- | --- |
| Concepts | [Concepts](./concepts.md) |
| Wiring | [Module setup](./module-setup.md) |
| Forms | [Forms](./forms.md) |
| Vapi | [Vapi adapter](./vapi-adapter.md) |
| Squads | [Workflow & Squad](./workflow-squad.md) |
| Full API | [Handbook](./handbook.md) → `vapi-studio/README.md` |
| Conversation design | [Best practices](../best-practices/README.md) |
| Example app | [Example apps](../building-apps/example-apps.md) (external repos) |
