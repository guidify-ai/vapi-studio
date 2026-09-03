# Concepts

Mental model for Vapi Studio. API detail: [handbook](./handbook.md).

## Conversation

A **Conversation** is one caller session:

- **Framework-generated `conversationId`** — canonical id (never replace with Vapi call id)
- **Variables** — seeded once at entry (channel, caller id, feature flags)
- **Memory** — mutable working state for the call
- **History** — turn log for Brain and forensics
- **Postgres row** — durable lifecycle; in-memory `SupervisedConversation` for active calls

## Turn lifecycle

Each user utterance (or silence timeout) triggers the **Supervisor** routing cascade:

```text
1. Force intentions (code + YAML transitions)
2. Condition transitions (memory expressions)
3. Match intentions on current node
4. Listen resolve (extract / resolveIntention — may skip Brain)
5. Brain scan (portal + node intentions)
6. Walk nodes (boot via before(), run)
```

On failure to route, the framework falls back to `studio.isUnknownTransition` rather than throwing.

## Agent steps

Agent steps are NestJS injectable classes extending `AgentNode`:

```typescript
export class AskNameNode extends AgentNode<MySchema> {
  async before(ctx) { return true; }  // CAN gate
  async listen(ctx) { /* register extract */ }
  async run(ctx) {
    return ctx.output.sayAndListen("What's your first name?", {
      extract: { fields: [{ key: 'firstName', /* … */ }] },
    });
  }
}
```

Declare methods in **runtime order**: `before` → `listen` → `run` → `after` → `catch`.

Agent steps speak only through `ctx.output` — never Vapi JSON directly.

## Flow YAML

`config/flow.yaml` declares:

- **start** node id
- **nodes** — class binding, intentions, `portal`, `priority`, `terminal`
- **transitions** — conditional jumps (`when`, `force`, `reason`)
- **portals** — global interrupts (goodbye, transfer, still-there, mad)

Lane changes inside one assistant use `ctx.output.continueTo({ nodeId })`.

## Intentions

Named signals routing the supervisor:

- **Standard** — `studio.isGoodbye`, `studio.isTransferToHuman`, `studio.isStillThere`, …
- **App** — `isAcceptedAppointment`, `isDidNotReceiveForm`, …
- **Code intention classes** — `INTENTION_CASCADE_PHASE` (`Force` \| `Match` \| `Scan`; see handbook)

## Brain

`BrainService` implements `scan` / `clarify` / `judge`. Model and confidence threshold are set in **`VapiStudioModule.forRoot({ brain })`** — not env vars.

Live-call rules: no pre-scan listen-hold on ChatGPT path; scan abort ≤ 3s; target first speech < 1.5s.

## Vapi integration

Vapi Custom LLM and webhooks translate wire format ↔ Vapi Studio I/O.

- **Live calls** — SSE streaming, tool calls for end/transfer/handoff
- **Flow Studio** — HTTP text harness on the same supervisor (application feature for local dev)

## Forms

`ctx.forms.open()` (live Vapi) or `expose()` (blocking Studio) + a **dispose adapter** delivers fillable surfaces. Submit → `claimSubmitted()` or blocking resume.

## Events

`EventService` emits and persists forensic events. Logs must explain **why** a turn routed. See [Events & logging](../reference/events-and-logging.md).

## Resume & recovery (post-MVP)

Framework ships optional helpers; **MVP apps start fresh each call** unless you explicitly opt in:

- **Cross-call resume** — `ConversationResumeService` (same caller within ~10 minutes)
- **Crash recovery** — `restoreAllActive()` on process boot (single-process; not multi-node failover)

## Workflows (optional)

Multi-assistant **Squad** handoffs via `workflow.yaml` — see [Workflow & Squad](./workflow-squad.md). Many apps use **one assistant** and `continueTo` lanes instead.
