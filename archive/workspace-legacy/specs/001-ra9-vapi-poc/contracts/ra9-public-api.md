# Contract: `@guidify-ai/ra9` public API

Application code may import only from package root exports.

## Module

```ts
Ra9Module.forRoot(options) | Ra9Module.forRootAsync(options)
```

Options include: TypeORM data source / persistence bindings, Brain provider binding, adapter binding, flow loader paths or injection tokens, standard intention registration.

## Core types / classes (conceptual export list)

- `Ra9Node` — abstract `boot(ctx): Promise<boolean>`, `run(ctx): Promise<NodeResult>`
- `NodeContext` — conversation access, memory, output port, logger
- `ConversationOutput` / output port methods used by nodes: `say`, `sayAndListen`, `endCall`, `transferToHuman`
- `Supervisor` / turn runner service
- `BrainService` interface + `MockBrainService`
- `FlowLoader` / `FlowDefinition` types
- `SupervisedConversationRegistry`
- `ConversationRepository` abstraction + TypeORM entity tokens as needed
- `EventService` / structured logger facade
- Standard intention constants: `RA9_INTENTIONS.isGoodbye`, `RA9_INTENTIONS.isTransferToHuman`
- Vapi adapter providers/tokens for SSE compilation
- Webhook strategy base types: `VapiStrategy`, `VapiCommand`, `VapiResponse` (generic enough for app strategies)

## Forbidden for applications

- Importing deep private paths such as `@guidify-ai/ra9/src/internal/...`
- Re-implementing provider SSE framing inside nodes
- Writing portal re-engagement counters directly to Postgres as turn source of truth

## Nest DI expectation

Application registers node classes as providers and maps flow `class` tokens → classes. Nodes inject arbitrary app services normally.
