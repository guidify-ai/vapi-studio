# Contract: Flow schema (PoC)

File: `roofr-poc/config/flow.yaml`

## Schema (semantic)

```yaml
version: 1

flow:
  id: roofr-poc
  start: acknowledge

nodes:
  acknowledge:
    class: AcknowledgeNode
    intentions:
      - isAcknowledge

  multiSay:
    class: MultiSayNode
    intentions:
      - isMultiSayTest

  continue:
    class: ContinueNode
    intentions:
      - isContinue

  goodbye:
    class: GoodbyeNode
    intentions:
      - ra9.isGoodbye
    terminal: true

  pause:
    class: PauseNode
    portal: true
    priority: 90
    intentions:
      - ra9.isPause

  transferToHuman:
    class: TransferToHumanNode
    portal: true
    priority: 100
    intentions:
      - ra9.isTransferToHuman
```

## Portal rules

- Portal ≠ a normal graph transition.
- Entering a portal stores `portalState.originNodeId` from the current normal flow node.
- Portal completion / next non-portal intention restores that origin; normal flow is not advanced by portal entry.
- `PauseNode` may be entered any number of times.
- `TransferToHumanNode` re-engagement counter lives in `portalState.transferToHuman` (in-memory only).

## Standard package intentions

- `ra9.isGoodbye`
- `ra9.isTransferToHuman`
- `ra9.isPause`

## Mock Brain profiles

`config/poc/state-machine.brain.yml`:

```yaml
sequence:
  - isAcknowledge
  - isMultiSayTest
  - ra9.isPause
  - isContinue
  - ra9.isGoodbye
```

`config/poc/transfer-human.brain.yml`:

```yaml
sequence:
  - isAcknowledge
  - ra9.isTransferToHuman
  - isContinue
  - ra9.isTransferToHuman
```
