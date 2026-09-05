# Data Model: RA9 Framework & Roofr Vapi PoC

## Durable store (PostgreSQL / TypeORM)

### Conversation

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | RA9 conversation id |
| provider | string | e.g. `vapi` |
| providerCallId | string unique | Vapi `message.call.id` correlation invariant |
| status | enum | `ACTIVE` \| `ENDED` |
| runtimeInstanceId | string nullable | Last known supervised runtime id (audit) |
| metadata | jsonb | Provider metadata safe to retain |
| createdAt | timestamptz | |
| endedAt | timestamptz nullable | |
| finalState | jsonb nullable | Frozen snapshot at end |

**Rules**:
- Created on `assistant-request`.
- `providerCallId` required and unique for PoC.
- Marked `ENDED` on terminal status-update; no active-call rebuild from this row in MVP.

### ConversationEvent (optional but recommended for PoC audit)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| conversationId | uuid FK | |
| type | string | e.g. `BOOTSTRAP`, `INTENTION_SCAN`, `NODE_ENTER`, `NODE_REJECT`, `SAY`, `LISTEN`, `INTERRUPT`, `TRANSFER`, `END_CALL`, `FINALIZE` |
| payload | jsonb | Structured details |
| createdAt | timestamptz | |

**Rules**:
- MVP may persist bootstrap + finalize always; mid-call events can be logged to stdout and selectively persisted.
- Not the active state machine.

## In-memory supervised runtime

### SupervisedConversation

| Field | Notes |
|-------|-------|
| runtimeInstanceId | Stable per-object id logged every turn |
| conversationId | RA9 id |
| providerCallId | Vapi call id |
| flowId | Loaded flow |
| currentNodeId | Nullable between turns / during portal intercept |
| brainProfileId | Active mock profile |
| brainSequenceIndex | Mock Brain cursor |
| portalState | e.g. `{ transferToHuman: { reengagementAttempts: number } }` |
| memory | Transient key/value bag |
| turn | Current turn counters / interruption flags |
| status | `ACTIVE` \| `FINALIZING` \| `ENDED` |

**Registry keys**: primary lookup `providerCallId` → runtime; secondary `conversationId`.

**Lifecycle**:

```text
assistant-request
  -> insert Conversation(ACTIVE)
  -> create SupervisedConversation (new runtimeInstanceId)
  -> registry.set(providerCallId, runtime)

custom-llm turn
  -> registry.get(providerCallId)  // MUST be same object
  -> Brain/Supervisor/Node/output

status-update ended
  -> finalize runtime
  -> update Conversation(ENDED, finalState, endedAt)
  -> optional event rows
  -> registry.delete(providerCallId)
```

## Flow schema entities (YAML → loaded model)

### FlowDefinition

- `version`, `id`, `start`
- `nodes`: map of NodeDefinition

### NodeDefinition

- `id`, `class` (application class token)
- `intentions: string[]`
- `portal?: boolean`
- `priority?: number`
- `terminal?: boolean`

## Intention model

### IntentionCandidate

- `name: string` (e.g. `isAcknowledge`, `ra9.isGoodbye`)
- `score/rank: number`
- `payload?: unknown`

### Standard package intentions

- `ra9.isGoodbye`
- `ra9.isTransferToHuman`

### Application PoC intentions

- `isAcknowledge`
- `isMultiSayTest`
- `isInterruptTest`

## Output / turn result model

### OutputAction (framework)

- `say(text)`
- `sayAndListen(text)`
- `endCall(text?)`
- `transferToHuman(destination?)` — destination configured at app/adapter level for PoC

### NodeResult

- Explicit terminal action required for successful completion of `run()`.

## State transitions

### Conversation.status

`ACTIVE` → `ENDED` (via status-update ended only in happy path)

### SupervisedConversation.status

`ACTIVE` → `FINALIZING` → `ENDED` (then removed)

### Transfer portal

`reengagementAttempts: 0` → first match increments to `1` and speaks re-engagement  
`reengagementAttempts: 1` → second match triggers adapter `transferCall`
