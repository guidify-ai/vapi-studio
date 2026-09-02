# Standard intentions

Framework-provided intention constants (`STANDARD_INTENTIONS`).

## Portal / global

| Constant | Typical portal node |
| --- | --- |
| `studio.isGoodbye` | Goodbye → `endCall` |
| `studio.isTransferToHuman` | Transfer (re-engage once, then transfer) |
| `studio.isStillThere` | Still-there (ghosting / silence) |
| `studio.isMad` | Mad escalation |
| `studio.isPause` | Pause |
| `studio.isUnknownTransition` | Unknown recovery (route fallback) |
| `studio.isContinue` | Resume / continue prior conversation |

## Polarity

| Constant | Use |
| --- | --- |
| `studio.isPositive` | Yes / affirm |
| `studio.isNegative` | No / decline |

## App naming conventions

From [Node conventions](../guides/node-conventions.md):

- **Actions:** `is{VerbPast}…` — `isCollectedFirstName`, `isAcceptedAppointment`
- **Polarity:** `studio.isPositive` / `studio.isNegative` when appropriate
- **Framework prefix:** `studio.*` for standard intentions only

## Code intentions

Code intention classes with:

| Phase | When |
| --- | --- |
| `force` | Preempt before current node (e.g. need SMS consent) |
| `match` | Node eligibility |
| `scan` | Brain candidate |

## Application examples

Your app defines intentions in `flow.yaml`, e.g. `isCollectedFirstName`, `isAcceptedAppointment`, `isDidNotReceiveForm`.

## Related

- [Flow schema](./flow-schema.md)
- [Concepts](../guide/concepts.md)
