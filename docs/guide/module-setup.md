# Module setup

Wire Vapi Studio into a NestJS application.

## Dependency

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:.."
  }
}
```

From `projects/<your-app>/`, `file:..` is the framework at the repository root.

Build the framework before typechecking the project:

```bash
# repo root
yarn build
cd projects/my-app && yarn install
```

## `VapiStudioModule.forRoot` options

| Option | Required | Purpose |
| --- | --- | --- |
| `nodes` | Yes | `{ className, useClass }[]` — every node in `flow.yaml` |
| `entryPoint` | Yes | `ConversationEntryPoint` — seed variables, `beforeEach` / `afterEach` |
| `brainAdapter` | Yes | `MockBrainAdapter`, `ChatGptBrainAdapter`, or custom |
| `brain` | No | `{ model, confidenceThreshold }` for ChatGPT adapter |
| `intentions` | No | Code intention providers (`phase: 'force' \| 'match' \| 'scan'`) |
| `formDisposeAdapter` | No | Delivers forms (HTML link, Studio modal, SMS later) |
| `eventListeners` | No | Subscribe to `EventService` (e.g. Studio buffer) |

## Node registration pattern

Every node class must be:

1. A Nest `@Injectable()` extending `AgentNode<YourSchema>`
2. Listed in `VapiStudioModule.forRoot({ nodes: [...] })`
3. Referenced in `config/flow.yaml` by `className`

## Conversation entry

```typescript
@Injectable()
export class MyConversationEntry implements ConversationEntryPoint<MySchema> {
  createVariables(ctx): MyVariables { /* channel, callerId, flags */ }
  async beforeEach(ctx) { /* resume peek, CRM hydrate */ }
  async afterEach(ctx) { /* optional */ }
}
```

## Flow file location

`FlowLoader` reads `config/flow.yaml` relative to `CONFIG_DIR` (default: app `config/` in Docker).

## Agent scaffolding

`yarn install` in an app runs postinstall:

- `.cursor/rules/vapi-studio-best-practices.mdc`
- `AGENTS.md` stamped block

Manual refresh:

```bash
INIT_CWD=$PWD node node_modules/@guidify-ai/vapi-studio/scripts/install-agent-refs.cjs
```

## Related

- [Concepts](./concepts.md)
- [Handbook](./handbook.md)
- [Creating a project](../projects/creating-a-project.md)
