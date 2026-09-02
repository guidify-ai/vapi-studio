# Flow schema

`config/flow.yaml` — conversation graph for a single assistant (or per-module file in Squad mode).

## Top-level shape

```yaml
version: 1
flow:
  start: acknowledge
nodes:
  acknowledge:
    class: AcknowledgeNode
    intentions:
      - isRequestedRoofEstimate
  goodbye:
    class: GoodbyeNode
    portal: true
    priority: 90
    terminal: true
    intentions:
      - studio.isGoodbye
transitions:
  - id: needFormSendConsent
    from: [identityCollect, routerTriage]
    to: askFormSendConsent
    when: memory.formSendConsent == undefined
    force: true
    reason: need_sms_form_consent
```

## Node fields

| Field | Purpose |
| --- | --- |
| `class` | Nest provider class name (must match `VapiStudioModule` registration) |
| `intentions` | String names for match routing on this node |
| `portal` | `true` — globally eligible interrupt (goodbye, transfer, still-there) |
| `priority` | Portal walk order (higher first) |
| `terminal` | Node may end conversation |

## Transitions

Condition edges evaluated before listen/Brain:

| Field | Purpose |
| --- | --- |
| `from` | Source node ids (list) |
| `to` | Target node id |
| `when` | Memory expression (`memory.field == value`, `&&`, `!=`) |
| `force` | `true` — preempt current node (dedicated sub-flow) |
| `reason` | Forensics string in `CONDITION_TRANSITION` |

Code intentions (`phase: 'force'`) run in the same cascade tier.

## Intention names

- **Framework:** `studio.isGoodbye`, `studio.isPositive`, `studio.isStillThere`, …
- **App:** `isCollectedFirstName`, `isAcceptedAppointment`, …

Naming rules: [Node conventions](../guides/node-conventions.md)

## `continueTo` vs YAML

- **`output.continueTo({ nodeId })`** — imperative lane jump (same flow file)
- **`transitions`** — declarative gates visible in Flow Studio graph
- **`handoff`** — Squad module switch (`workflow.yaml`)

## `workflow.yaml` (optional)

Multi-module Squad config — see [Workflow & Squad](../vapi-studio/workflow-squad.md).

## Historical contract

Compare with your application's `config/flow.yaml` in its own repository.

## Related

- [Concepts](../guide/concepts.md)
