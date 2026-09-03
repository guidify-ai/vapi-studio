# Workflow & Squad

Optional multi-assistant deployments. Many apps use **one assistant** and `continueTo` instead.

## When to use

| Pattern | Use |
| --- | --- |
| `continueTo({ nodeId })` | Same assistant, same Conversation — lane jumps |
| `handoff({ moduleId })` | Vapi Squad — switch assistant, shared workflow memory |

## `workflow.yaml`

```yaml
version: 1
workflow:
  id: my-workflow
  entryModule: router
modules:
  router:
    assistantName: MyRouter
    kind: studio
    flowFile: modules/router.flow.yaml
    entryNode: routerTriage
  identity:
    assistantName: MyIdentity
    kind: studio
    flowFile: modules/identity.flow.yaml
```

- `WorkflowLoader` resolves module id ↔ Vapi `assistantName`
- `WorkflowHandoffService` enriches handoff actions, checkpoints, emits `WORKFLOW_HANDOFF`
- Handoff does **not** finalize the Conversation

## URLs

- `POST /{projectUuid}/vapi/:moduleId/chat/completions`
- Header `X-Vapi-Studio-Module` also accepted

## Vapi handoff tool

SSE must call the handoff function with **`destination` as a string** (Squad member name), e.g.:

```json
{ "destination": "MyIdentity" }
```

Not `{ type, assistantName }` objects — that is assistant config, not tool-call args.

## Examples on disk (not loaded by default)

Ship example configs in your app repo (e.g. `config/workflow.squad.example.yaml`, `config/vapi-squad.example.json`).

Copy to `workflow.yaml` only when deliberately enabling Squad.

## Related

- [Handbook](./handbook.md) — workflow section
- [Example apps](../building-apps/example-apps.md) — single-assistant vs squad patterns
