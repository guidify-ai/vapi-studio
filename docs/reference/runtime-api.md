# Runtime API reference

Shipped behavior and contracts for `@guidify-ai/vapi-studio`. **Update this file in the same change as any framework code change.**

The repository [README](../../README.md) is the entry index — not a usage guide. Start there, then use [docs/README.md](../README.md) for navigation.

---

## Overview

**Deterministic voice agents** for Vapi — NestJS orchestration with typed agent steps, explicit `flow.yaml` paths, and optional Brain interpretation at listen boundaries.

Vapi Studio is not a no-code builder and not an open-ended LLM agent. Behavior is **code + YAML routing**; the Brain assists where interpretation is needed, not where the graph is already decided.

- **Repository:** [guidify-ai/vapi-studio](https://github.com/guidify-ai/vapi-studio)
- **Entry index:** [README.md](../../README.md)
- **Documentation site:** [`docs/README.md`](../README.md)
- **Best practices:** [`docs/best-practices/`](../best-practices/) · [`agent/AGENTS.md`](../../agent/AGENTS.md)
- **Example applications:** [`docs/building-apps/example-apps.md`](../building-apps/example-apps.md) · [`projects/`](../../projects/README.md)

Application-specific agent steps, copy, and flows do **not** belong in this repository.

```json
{
  "dependencies": {
    "@guidify-ai/vapi-studio": "file:.."
  }
}
```

Build the package (`yarn build` → `dist/`) before the app type-checks against it. App runtime is Docker-only in the current PoC; Yarn in Docker is the supported install path.

**Agent refs on install:** `postinstall` runs `scripts/install-agent-refs.cjs`, which writes `.cursor/rules/vapi-studio-best-practices.mdc` and a stamped block in the app’s `AGENTS.md` pointing at `docs/best-practices/`. Re-run with `yarn install-agent-refs` from the package (with `INIT_CWD` set to the app) or `yarn install` in the app.

Wire Nest:

```ts
VapiStudioModule.forRoot({
  nodes: [{ className: 'GoodbyeNode', useClass: GoodbyeNode }],
  entryPoint: MyConversationEntry,
  brainAdapter: MockBrainAdapter,        // or ChatGptBrainAdapter / app class
  brain: {
    model: 'gpt-4.1-nano',               // cheap whitelist; not .env
    confidenceThreshold: 0.4,
  },
  eventListeners: [],
})
```

## Architecture

| Piece | Role |
| --- | --- |
| **Conversation** | One durable identity per provider call (`providerCallId`) + one in-memory `SupervisedConversation` for the live call |
| **Supervisor** | Each user turn: condition forces → listen resolve / Brain → walk candidates → `before()` → `listen()` → `run()` → `after()` |
| **Node** | Application class. Owns speech, memory writes, integrations, terminal action |
| **Flow YAML** | Paths: start node, class names, intentions, portals, priority, optional **condition transitions** |
| **Brain** | `scan` / `clarify` / `judge`. Does not own routing |
| **Adapter** | Channel wire format (Vapi Custom LLM SSE, call id, tools). Nodes never see it |
| **Events** | `EventService.emit` → console + listeners (Postgres by default) |
| **Integrations** | Signed outbound HTTP from Nodes via `ctx.integrations.request` |

Happy-path live call (MVP): bootstrap → in-memory runtime reused across Custom LLM turns → checkpoint to Postgres after each turn → `status-update: ended` finalize. **Crash recovery:** ACTIVE rows keep `runtime_state`; on process boot (and via `ConversationBootstrapService.restoreAllActive()`) runtimes are rebuilt into the registry. `simulateCrash()` drops memory only for drills.

**Cross-call resume (≤10 min):** `conversations.caller_id` + `last_activity_at` index prior ENDED/`final_state` or abandoned ACTIVE/`runtime_state` for the same caller. Apps peek via `ConversationResumeService.peek`, ask the caller, then `applyClone` overlays memory/history/portal/node/module onto the **new** call and clones `conversation_events` (with `clonedFrom*` provenance). Abandoned ACTIVE priors are finalized so they cannot be offered again.

## Conversation lifecycle

1. Channel bootstrap (`assistant-request`, `assistant.started`, lazy Custom LLM, or early `status-update`) calls `ConversationBootstrapService.bootstrap({ providerCallId, brainProfileId, metadata })`.
2. Postgres row `conversations` (ACTIVE) + in-memory `SupervisedConversation` with a `runtimeInstanceId`. Concurrent bootstrap for the same call is serialized and reused. `caller_id` is stamped from metadata/variables and refreshed on every checkpoint.
3. Optional `ConversationEntryPoint.createVariables` + `beforeEach`, then an initial `runtime_state` checkpoint. If a workflow is loaded, set `workflowId` / `activeModuleId` and load the entry module’s flow.
4. Each Custom LLM / studio turn: correlate call id → same runtime → ensure active module flow → `Supervisor.handleTurn` → **checkpoint** (`conversations.runtime_state`, bumps `last_activity_at`). `output.continueTo` jumps within one flow (`FLOW_CONTINUE`); `output.handoff` switches workflow module on the same Conversation (`WORKFLOW_HANDOFF`). Neither finalizes.
5. Process restart: `restoreAllActive()` rebuilds every ACTIVE row that has `runtime_state` into the registry (apps typically call this on boot).
6. `status-update: ended` / studio hangup / farewell `endCall` → `afterEach` → persist `final_state` → drop registry + turn queue.
7. Optional: same `caller_id` returns within the resume window → app asks → `ConversationResumeService.applyClone` continues at the prior node/module on the new Conversation.

Identity is the **provider call id**. One supervised runtime per active call. Disaster drill helpers: `simulateCrash()`, `restoreAllActive()`, `disasterStatus()`.

## Supervisor routing

Turn routing is a **cascade** (first hit wins; later steps are skipped):

1. **Code intentions `phase: 'force'`** — `CodeIntention.before()` / `match()` / `run()` with full memory/history/regex freedom. No listen resolve, no Brain. Forensic: `INTENTION_FORCE` + `resolvedVia: intention_force`. Console **IFORCE**.
2. **YAML condition `force: true` transitions** — declarative sugar over memory/variables. Forensic: `CONDITION_TRANSITION`. Console **FORCE**.
3. **Code intentions `phase: 'match'`** — local `match()` confidence; may `goto` or inject a score and skip Brain (`intention_match` / **IMATCH**).
4. **Listen `resolveIntention`** — cheap local match → Brain skipped (`listen_resolve`).
5. **Brain `scan`** — scores candidates; soft YAML conditions + registered intention `boost`/`priority` feed the walk.
6. **Walk** — Node `before()` → enter → `listen` / `run` / `after`.

## Intentions (code)

Intentions are classes — same spirit as Nodes. Register on `VapiStudioModule.forRoot({ intentions: [...] })`.

```ts
@Injectable()
export class NeedSmsPhoneIntention extends CodeIntention {
  readonly name = 'isNeedSmsPhone';
  phase = 'force';          // run BEFORE Brain
  toNodeId = 'askSmsPhone'; // or return { kind: 'goto', nodeId } from run()
  priority = 1_000_000;
  boost = 0;                // Brain hint when phase is scan/match
  reason = 'need_sms_phone';

  async before(ctx) {
    return (
      ctx.memory.formSendConsent === true &&
      ctx.memory.phoneConfirmed !== true
    );
  }
  // optional: match(), run(), after()
}
```

| Field | Role |
| --- | --- |
| `name` | Stable id (same string listens / flow / Brain use) |
| `phase` | `force` \| `match` \| `scan` (default) |
| `boost` | Brain scoring hint |
| `priority` | Walk order when ranked |
| `toNodeId` | Destination when force/match wins (optional if `run()` returns `goto`) |

Lifecycle: `before` → `match` → `run` → `after`. YAML `transitions` remain for visualization; **code force intentions run first**.

String-only intention names in `flow.yaml` still work (`phase: scan` behavior).

## Nodes

`AgentNode<TSchema>` — declare overrides in **runtime order**:

1. `before(ctx)` — authorize / prepare; `false` rejects this candidate
2. `listen(ctx)` — register the **next** listen (intentions, hints, extract, optional `timeoutSeconds`) **before** speech so mid-talk interrupts still bind
3. `run(ctx)` — **required**; must end the turn with a terminal output action
4. `after(ctx, result)` — teardown for this execution
5. `catch(ctx, error)` — optional recovery (`restartNode`, `forceIntention`, `catchResult`, `rethrowCatch`)

Intention **action** names: `is{VerbInPast}…` (`isCollectedFirstName`). Polarity adjectives are fine (`studio.isPositive`).

`ctx` includes typed `memory` / `conversation.variables`, `output`, `events`, `clarify`, `judge`, `integrations`, history helpers.

### Listen timeout

How long the channel waits after a user pause before closing the listen (so ASR crumbs like `"K."` do not steal the turn from `"as soon as possible"`).

| Layer | Where | Wins over |
| --- | --- | --- |
| Framework default | `DEFAULT_LISTEN_TIMEOUT_SECONDS` (`2.5`) | — |
| Node class | `listenTimeoutSeconds` on the `AgentNode` subclass | default |
| `listen()` | `ListenExpectation.timeoutSeconds` | Node class |
| `sayAndListen({ timeoutSeconds })` | that turn only | `listen()` |

Clamped to `[0.4, 12]`. The Supervisor stamps the resolved value onto `runtime.listenExpectation`. Transient `assistant-request` assistants get a matching Vapi `startSpeakingPlan`. **Do not hold the Custom LLM request** when the Brain is ChatGPT — that delay plus OpenAI latency makes Vapi retry and the caller repeat. **Exception:** a listen with `interruptible: false` (address dictation) queues overlapping Custom LLM POSTs until **3s of silence** after the last fragment, then scans once. Mock Brain may still pass `listenHoldMs` to coalesce ASR crumbs. ChatGPT scans abort after **3s** and fall back to `studio.isUnknownTransition`. Target: first SSE speech **< 1.5s** after the Custom LLM request (live conversation — silence is a failure). **Speech must land on the Custom LLM HTTP request Vapi is still listening to.** A queued/coalesced waiter replays `lastAssistantSpeech`; it must not finish with empty SSE. **Shit in, shit out:** Vapi duplicate/stale Custom LLM posts are a provider artifact — do not teach scan prompts or Nodes to detect “stale repeats.” Garbage ASR and weird callers are not fully in scope; unknown / re-ask is enough.

Override on the class:

```ts
export class AskTimelineNode extends AgentNode {
  listenTimeoutSeconds = 3.5;
}
```

### Output (terminal invariant)

A Node may `say()` several times in one turn. It must finish with exactly one of:

- `sayAndListen(text, options?)` — speak and wait (optional `extract`, `timeoutSeconds`, `onExtracted` that **the app** writes into memory)
- `endCall(text?)` — ends the Conversation (Vapi → end-call tool)
- `transferToHuman(destination?)` — phone transfer (Vapi → `transferCall` tool)
- `handoff({ to, reason?, payload?, text? })` — leave this **workflow module** without ending the Conversation (`to` = module id; Vapi → Squad handoff tool). Requires a loaded `workflow.yaml`.
- `continueTo({ nodeId, reason?, text? })` — jump to another Node in the **same** loaded flow and speak its entry next (Studio / single-assistant Vapi). Emits `FLOW_CONTINUE`; does **not** emit a Squad handoff tool.
- `toolCall({ name, arguments?, text? })` / `callTool(...)` — request a channel tool **by name** (Vapi Custom LLM → OpenAI-compatible `tool_calls` SSE). Use for app/Vapi tools that are not the three semantic helpers above. `callTool` is an alias of `toolCall`.

```ts
// Prefer semantic helpers when they apply:
await ctx.output.endCall('Goodbye.');
await ctx.output.transferToHuman('+15551234567');
await ctx.output.continueTo({ nodeId: 'identityCollect' });
await ctx.output.handoff({ to: 'identity' }); // Squad only — needs workflow.yaml

// Convention — request by name; the Vapi assistant must already have that tool:
return ctx.output.toolCall({
  name: 'send_sms_form',
  arguments: { to: ctx.memory.contactPhone, formId: 1 },
  text: 'I am texting that form now.', // optional speech before the tool call
});
// same:
return ctx.output.callTool({ name: 'send_sms_form', arguments: { … } });
```

`endCall` / `transferToHuman` / `handoff` stay adapter-owned name resolution. `toolCall` / `callTool` emit the exact `name` you pass — they do **not** look up a shared inventory. Operator convention: that name is pre-provisioned on the Vapi assistant (`model.tools`).
### Forms (`ctx.forms.expose`)

Blocking structured collection. Apps deliver via a dispose adapter — Studio modal, **first-party HTML** (`renderFormHtml` + `GET/POST /forms/:exposeId`), or later SMS.

The dispose adapter is the **sendout driver**. It declares a delivery `branch` (`html_link`, `sms`, `unavailable`, …). The app may also pass a conversation `branch` on expose (e.g. `identity_html_form`) so logs show which flow lane requested the form.

```ts
const values = await ctx.forms.expose({
  formId: 1,
  branch: 'identity_html_form', // conversation lane (forensics)
  fields: [
    { name: 'firstName', label: 'First name', type: 'string', required: true },
    { name: 'address', label: 'Address', type: 'textarea', required: true },
  ],
  disposeContext: { contactPhone: '2365621379', channel: 'phone' },
  onDelivered: async () => {
    await ctx.output.say('I exposed a form — please fill it out. I will wait.');
  },
});
```

1. **`FORM_SENDOUT` (persist, early)** — `branch` + `deliveryBranch` + adapter id **before** ACK/fillout wait. Console tag **FORM**.
2. Dispose adapter delivers (`VapiStudioModule.forRoot({ formDisposeAdapter })`). Adapter `readonly branch` is the delivery lane. Optional `disposeContext` is opaque app data.
3. Framework waits **≤ 15s** for channel ACK (`FormsService.ack`) — else `FormDeliverTimeoutError`. Adapters may ACK when a link is ready.
4. `onDelivered` runs; then either:
   - **`expose()` (blocking)** — waits for submit (Studio-friendly; keeps the channel turn open).
   - **`open()` (preferred on live Vapi)** — returns after delivery so the Custom LLM turn can finish (`stop`/`[DONE]`), TTS can complete, and silence timers do not fight a multi-minute hold. Later: `submit` → `claimSubmitted()` (or FormResume / still-there).
5. **`ctx.forms.resend()`** — re-runs dispose on the open (unsubmitted) expose when the caller says they never got the SMS / link. Same `exposeId` + stored `disposeContext`; emits `FORM_RESEND` (persist) + `FORM_RESENT`. Returns `null` if nothing is pending.
6. Events: `FORM_SENDOUT`, `FORM_EXPOSE`, `FORM_DELIVERED`, `FORM_RESEND` / `FORM_RESENT`, `FORM_DELIVER_TIMEOUT`, `FORM_SUBMITTED`, `FORM_FILLOUT_TIMEOUT` (plus app `FORM_LINK_READY`).
7. HTML helper: `renderFormHtml(handle)` / `renderFormThanksHtml()` / `renderFormGoneHtml()` — JSON fields → page; apps own the HTTP routes.
8. `ctx.forms.hasPending()` / `hasUnclaimedSubmit()` / `claimSubmitted()` / `resend()` — ghosting must no-op while pending; claim after submit on the open path; resend when delivery failed on the caller’s device.

Default dispose is **noop** (`branch: unavailable` — ACK never arrives → Nodes fall back to voice).

The Vapi adapter compiles those actions to OpenAI-compatible SSE + tool calls (`end_call_tool`, `transferCall`, Squad `handoff`). Tool names are env-configurable (`VAPI_HANDOFF_TOOL_NAME`, default `handoff`). Handoff does **not** finalize the Conversation.

**Vapi-compatible handoff tool call:** Custom LLM SSE must call the advertised handoff function with **`destination` as a string** (the Squad member `assistantName`), e.g. `{"destination":"IdentityLane"}`. Do not send `{ type, assistantName }` objects — that is assistant *config*, not the tool-call argument. Prefer destination-specific tools (`handoff_to_<Name>`) when Vapi advertises them. Each Squad member assistant must declare `type: "handoff"` tools with `destinations[].assistantName` matching `workflow.yaml` (put tools on the assistant `model.tools[]`, not only in the Squad builder UI).

## Workflow (Squad) + modules

A **workflow** is the Vapi Studio equivalent of a Vapi Squad: one durable Conversation with shared memory, history, portals, events, and checkpoints. Each **module** is a Squad member (own `flow.yaml` + Nodes; Custom LLM URL or native Vapi assistant).

App-owned `config/workflow.yaml`:

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
    entryNode: routerTriage   # optional; handoffs use this (opening still uses flow.start)
  identity:
    assistantName: MyIdentity
    kind: studio
    flowFile: modules/identity.flow.yaml
  farewell:
    assistantName: MyFarewell
    kind: studio
    flowFile: modules/farewell.flow.yaml
```

- `WorkflowLoader` — load / resolve module id ↔ Vapi `assistantName`
- `WorkflowHandoffService.applyHandoffs` — enrich actions with `assistantName`, set `metadata.activeModuleId`, load the next Vapi Studio flow, emit `WORKFLOW_HANDOFF`, checkpoint; **never** `finalizeEnded`
- After handoff, `metadata.moduleNeedsEntrySpeak` — Supervisor speaks the destination entry Node on the next empty/module-entry turn (Studio may do this in-process; Vapi after Squad switch)
- One deployment can serve all Vapi Studio members via `POST /vapi/:moduleId/chat/completions` or header `X-Vapi-Studio-Module`

Native Vapi members use `kind: vapi` (no flow file) — Vapi Studio only emits the handoff tool; Vapi owns that assistant.

Portals stay globally eligible in every module (same runtime).

### Listen / extract

`listen()` / `sayAndListen({ extract })` tell Brain what to score and which JSON fields to pull. The framework does not auto-assign memory: `onExtracted` is application-owned. Listen timeout is documented above.

**Closed choice (`resolveIntention`)** — after the bot listed numbered options, attach a cheap matcher on the listen. If it returns an intention name that is on that listen, Supervisor **skips Brain** and walks that intention at confidence 1 (no 3s abort). Return `null` to fall through to Brain so portals and unknown still work. Use this for pick-N / neither, not for free-form answers. A skipped scan still advances `brainSequenceIndex` so MockBrain sequences stay aligned.

```ts
return ctx.output.sayAndListen('I have two matches. Which one is correct?', {
  resolveIntention: ({ userText, memory }) => {
    // 'isConfirmedAddressMatch' | 'isRejectedAddressMatch' | null
  },
});
```

## Flow YAML

YAML describes **paths**, not implementations. No URLs, no integration payloads.

```yaml
version: 1
flow:
  id: my-bot
  start: acknowledge
nodes:
  acknowledge:
    class: AcknowledgeNode
    intentions:
      - isAcknowledged
  askSmsPhone:
    class: AskSmsPhoneNode
    intentions:
      - isCollectedPhone
  identityCollect:
    class: IdentityCollectNode
    intentions:
      - isIdentityCollect
  goodbye:
    class: GoodbyeNode
    intentions:
      - studio.isGoodbye
    terminal: true
  transferToHuman:
    class: TransferToHumanNode
    portal: true
    priority: 100
    intentions:
      - studio.isTransferToHuman

# Optional — declarative gates (visualizable; OK to duplicate node continueTo).
transitions:
  - id: needSmsPhone
    from: [identityCollect, routerTriage]
    to: askSmsPhone
    when: memory.formSendConsent == true && memory.phoneConfirmed != true
    force: true
    reason: need_sms_phone
```

- Exactly one `start`
- `class` maps to `VapiStudioModule.forRoot({ nodes: [{ className, useClass }] })`
- `portal: true` — eligible every turn, not only from the current listen
- `priority` on the node feeds Supervisor walk (with listen-level priority)
- **`transitions`** — condition edges evaluated each turn against `memory.*` / `variables.*` (alias `var.*`):
  - `when`: boolean expression (`==`, `!=`, `!`, `&&`, `||`, parentheses). Missing keys are falsy; `== undefined` / `== null` are nullish.
  - `from`: optional allow-list of current node ids (omit = any node except `to`)
  - `to`: destination node id (must exist)
  - `force: true`: cascade step 1 — skip listen resolve + Brain (`studio.goto.<to>`)
  - `force: false` / omitted: soft boost into the Brain walk (default priority `50`)
  - `reason` / `id`: forensics (`CONDITION_TRANSITION`)

Prefer **dedicated Nodes** for gap-fill (phone, consent, name) and declare the gate in `transitions` so paths stay visible even if Nodes also `continueTo` the same place (DRY breach is fine when determinism matters).

## Brain

Port (`BrainService` / `BrainAdapter`) — Supervisor depends only on this:

| Method | Use |
| --- | --- |
| `scan` | Rank candidates + optional `extracted` map |
| `clarify` | Structured Q&A; always `{ answer: object }` |
| `judge` | LLM-as-a-judge for **evals**; rare on the live path |

Judge result: `{ passed, confidence, reasoning, belowThreshold }`. `confidence` is always `/^\d\.\d{6}$/`. Threshold does **not** flip `passed`. Trusted pass = `passed && !belowThreshold`. Paid e2e evals are not in the current delivery slice.

Stock adapters:

- `MockBrainAdapter` — deterministic sequences / profiles (PoC default)
- `ChatGptBrainAdapter` — cheap OpenAI whitelist only (`gpt-4.1-nano`, `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-5.4-nano`). Scan HTTP timeout **3s**; failure → unknown. Live path: no pre-scan hold; first speech target **< 1.5s**. Do not special-case Vapi stale repeats in the scan prompt. Enable in **application code**.

Apps may supply their own adapter (e.g. HTTP Brain) via `brainAdapter`.

Brain **model** and **scan threshold** are `VapiStudioModule.forRoot({ brain })`. Only `OPENAI_API_KEY` belongs in `.env`. End of call may log `BRAIN_COST_SUMMARY` when the ChatGPT adapter recorded usage.

## Standard intentions and portals

Package-owned **names** (behavior is always an application Node):

| Constant | Name |
| --- | --- |
| `STANDARD_INTENTIONS.isGoodbye` | `studio.isGoodbye` |
| `STANDARD_INTENTIONS.isTransferToHuman` | `studio.isTransferToHuman` |
| `STANDARD_INTENTIONS.isPause` | `studio.isPause` |
| `STANDARD_INTENTIONS.isMad` | `studio.isMad` |
| `STANDARD_INTENTIONS.isUnknownTransition` | `studio.isUnknownTransition` |
| `STANDARD_INTENTIONS.isPositive` | `studio.isPositive` |
| `STANDARD_INTENTIONS.isNegative` | `studio.isNegative` |
| `STANDARD_INTENTIONS.isStillThere` | `studio.isStillThere` |
| `STANDARD_INTENTIONS.isToolResult` | `studio.isToolResult` |

Portals are global Nodes (`portal: true`). Transfer-to-human typically re-engages **once** in memory, then emits `transferToHuman`. Still-there tracks `portalState.stillThere.attempts` (ask ×2, then `endCall`). Portal counters are in-memory on the active runtime, not the durable turn source of truth.

**Mad is sticky:** once in the `mad` portal, Supervisor does not offer other portals (or unknown) until the caller continues / goodbyes. Other listens may still escalate *into* mad via `studio.isMad`.

**`isContinue` / ContinueNode:** not a spoken filler. When the walk selects Continue, Supervisor **exits the portal**, restores `originNodeId`, refreshes that Node’s `listen()`, re-scans the **same** user utterance, and routes again (skips re-selecting `isContinue` to avoid a loop). Apps must not ship “Okay, continuing.” as Continue behavior.

## Vapi integration

### Vapi owns the call / Vapi Studio owns the logic

| Owner | Responsibility |
| --- | --- |
| **Vapi** | Telephony, TTS, STT, Tools **host + execution**, Squads, **Evals**, phone numbers, silence clock (`customer.speech.timeout`) |
| **Vapi Studio** | Deterministic structure, memory, extraction/clarify, when to request tools/handoffs/endCall, Conversation portals |

**Do not reimplement Vapi Evals** in Vapi Studio. Unit/schema/runtime tests live here; voice E2E belongs in Vapi Evals. Local Flow Studio substitutes for Custom LLM logic without a live call — it is not a second Evals platform.

#### Tool convention (expected desync)

The only durable “desync” between Vapi and Vapi Studio is **which tools the assistant really has**. That is a **config convention**, not shared runtime state:

1. Nodes / semantic helpers **request tools by name** (`endCall`, `transferToHuman`, `handoff`, `callTool({ name })`) — blindly, assuming the live assistant was provisioned with them.
2. The **Vapi assistant** (Squad member `model.tools[]`, hooks, server tools) must be **pre-provided** with those tools. Vapi Studio does not sync or invent the inventory.
3. When Custom LLM requests include `body.tools`, Vapi Studio may stash them as `ctx.tools` for **optional** visibility / operator warnings (`TOOL_CALL_NOT_ADVERTISED`). Nodes should **not** treat `ctx.tools` as a required gate — empty ads or Studio turns are normal.

Vapi treats the app as an OpenAI-compatible Custom LLM.

- Webhook: server messages (`assistant-request`, `assistant.started`, `status-update`, `user-interrupted`, `tool-calls`, …). Strategies live in the **app**; helpers live here (`extractVapiCallId`, `extractVapiCallerNumber`, `extractAdvertisedTools`, `extractToolResults`).
- Custom LLM: `POST …/chat/completions` — **one request per turn**, SSE stream, then close. `VapiSseCompiler` writes chunks and terminal tool calls (`endCall`, `transferCall`, Squad `handoff` with `destination: "<assistantName>"`, plus generic `output.toolCall` / `output.callTool`). Mock Brain may hold `listenTimeoutSeconds` to coalesce ASR crumbs; ChatGPT must not — scan starts immediately.
- Each Custom LLM turn may stash `body.tools` → `ctx.tools` (optional ads), `role:tool` → `ctx.toolResult(s)`, and call metadata → `ctx.vapi`. Tool-result-only turns (no new user speech) **re-enter the Node** that emitted `toolCall` without a Brain scan of empty text. Idle / still-there uses `Supervisor.handleTurn({ forceIntention: 'studio.isStillThere' })` (Studio timer or server tool from Vapi speech-timeout hooks) — **not** `listenTimeoutSeconds`.
- **LLM-requested tools** (Custom LLM SSE `tool_calls`) vs **server-dispatched tools** (webhook `message.type === 'tool-calls'`) are different paths; apps implement the latter in a webhook strategy.
- Workflow modules: prefer one app with per-member URLs (`/vapi/:moduleId/chat/completions`) or `X-Vapi-Studio-Module` so the same Conversation + `activeModuleId` serve the Squad. Squad handoff *rules* live on each Vapi assistant (`model.tools` type `handoff`); Vapi Studio only emits the matching tool call when a Node returns `output.handoff`.
- Helpers: `buildVapiHandoffToolArgs`, `hasAdvertisedHandoffTool`, `resolveHandoffToolName(tools, assistantName)`.
- Correlation: call id from body/headers. Missing call id is an error, not a silent new Conversation.

Nodes speak through `ConversationOutput`. They never format SSE.

```ts
// Blind request by convention — Vapi assistant must already expose this tool:
return ctx.output.callTool({
  name: 'lookupCustomer',
  arguments: { phone: ctx.vapi.phoneNumber },
});

// Next Custom LLM request after Vapi runs the tool:
const result = ctx.toolResult('lookupCustomer');
```

## Integrations

```ts
await ctx.integrations.request({
  name: 'example.slots',
  url: 'https://example.test/v1/slots',
  body: { day: 'tomorrow' },
  secretEnvKey: 'EXAMPLE_JWT_SECRET', // name of the .env key, not the secret
});
```

JWT HS256 of the canonical body bytes in `x-signature` (Node `crypto`, no `jsonwebtoken`). Events: `INTEGRATION_REQUEST` / `INTEGRATION_RESPONSE` / `INTEGRATION_ERROR`.

## Events, console, daily logs

**Doctrine:** logs + persisted events must be enough to answer any question about a call. See [`docs/best-practices/debugging-and-observability.md`](./docs/best-practices/debugging-and-observability.md).

`EventService.emit` / `.log` → pretty conversation console **and** (for `emit`/`persist`) registered listeners.

- Default listener: `PostgresEventListener` → `conversation_events`
- Extra listeners: `VapiStudioModule.forRoot({ eventListeners: [...] })`
- Console: `RA9_CONSOLE_DEBUG` (default on). Disable with `0` / `false` / `off`
- File driver: still prints console; also appends ANSI-stripped lines to `{LOG_DIR}/dailyYYYYMMDD.log`
- **The log directory is owned by the application** (each project keeps a `logs/` folder and sets `LOG_DIR`). The framework only writes there.
- Retention: `LOG_DAYS` (default **14**). Files at or older than that are deleted
- Each call writes a banner once:

```text
--------------------
Call ID: {vapi_call_id}
Caller Phone Number: {webhook customer number, or blank}

```

### Forensic turn events (shipped)

| Type | Pipe | Answers |
| --- | --- | --- |
| `CUSTOM_LLM_TURN` / `OPENING_TURN` | log | User text + memory diff |
| `CONDITION_TRANSITION` | **persist** | Matched `flow.yaml` transition (`force` / soft), when, from→to — console **FORCE** / **WHEN** |
| `INTENTION_FORCE` / `INTENTION_MATCH` | **persist**/log | Code `CodeIntention` cascade — console **IFORCE** / **IMATCH** |
| `FORM_SENDOUT` | **persist** | Early: conversation `branch` + adapter `deliveryBranch` before ACK — console **FORM** |
| `LISTEN_RESOLVED` / Brain scan | log | Intention source + scores |
| `INTENTION_SCAN` | log | Candidates, listen, threshold, memory |
| **`ROUTE_DECISION` / `ROUTE_FAILED`** | **persist** | Walk order, listen boosts, `rejected[]` (`before_false` / `missing`), winner, `resolvedVia` (`condition_force` / `condition_boost` / `listen_resolve` / `brain` / `route_fallback_unknown`), `userText`, memory. If every candidate’s `before()` refuses, Supervisor falls back once to `studio.isUnknownTransition` instead of throwing (Custom LLM must not 500). |
| `NODE_ENTER` / `NODE_AFTER` | log | Enter + result detail (`continueTo` target/reason, say text, actions) |
| `FLOW_CONTINUE` | persist | Same-flow jump from/to/reason |
| `NODE_REJECT` | log | Single `before()` refusal (also rolled into `ROUTE_DECISION.rejected`) |
| `FORM_*` | log/persist | Expose / deliver / submit / timeouts (carry `branch` + `deliveryBranch`) |

Memory console diffs include conversation-critical flags such as `introSpoken` (only bootstrap infra keys are stripped).

Disable file logs with `RA9_FILE_LOG=0`. Tests skip files unless `LOG_DIR` is set.

## Persistence (PoC)

TypeORM + PostgreSQL:

- `conversations` — durable identity, status, metadata, final snapshot
- `conversation_events` — event history
- `provider_ingress` — raw webhook / Custom LLM bodies for operator inspection

Active-call state (portal counters, listen registration, turn queue) stays **in memory**.

## Public API (start here)

Export surface is `src/index.ts`. Important groups:

- `VapiStudioModule`, `AgentNode`, `NodeContext`, `Supervisor`
- `ConversationBootstrapService`, `SupervisedConversation`, registries, `CallTurnQueue`
- `ConversationEntryPoint`, schema/history types
- `BrainService` / adapters / `STANDARD_INTENTIONS` / `BrainConfig`
- `FlowLoader`, `WorkflowLoader`, `WorkflowHandoffService`
- `FormsService`, `FORM_DISPOSE_ADAPTER`, form types / timeout errors
- `EventService`, daily-log helpers
- `IntegrationClient`, JWT helpers
- `VapiSseCompiler`, `extractVapiCallId`, `extractVapiCallerNumber`, `resolveHandoffToolName`, `buildVapiHandoffToolArgs`, `hasAdvertisedHandoffTool`
- Listen timeout: `DEFAULT_LISTEN_TIMEOUT_SECONDS`, `AgentNode.listenTimeoutSeconds`, `AgentNode.interruptible`, `listenTimeoutToVapiStartSpeakingPlan`
- Catch helpers: `restartNode`, `forceIntention`, `FlowUncertainError`

## Env the framework reads

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | ChatGPT adapter secret only |
| `RA9_CONSOLE_DEBUG` | on | Pretty stdout |
| `RA9_FILE_LOG` | on | Daily files |
| `LOG_DIR` | `logs` | Directory the **app** owns (project `logs/`); framework writes `dailyYYYYMMDD.log` here |
| `LOG_DAYS` | `14` | Retention |
| `RA9_FORM_ACK_MS` | `15000` | Form deliver ACK window (tests may lower) |
| `VAPI_END_CALL_TOOL_NAME` | `end_call_tool` | End-call tool (must match the Vapi tool name) |
| `VAPI_TRANSFER_CALL_TOOL_NAME` | `transferCall` | Transfer tool |
| `VAPI_HANDOFF_TOOL_NAME` | `handoff` | Squad module handoff tool |
| `VAPI_TRANSFER_DESTINATION` | — | E.164 for `transferCall` destination |
| `CONFIG_DIR` | app `config/` | Flow + `workflow.yaml` search path |
| `RA9_CONSOLE_DEBUG_ALL` | off | Verbose console (all events) |

Apps add their own env (database URL, public base URL, transfer destination). Document in project README / `docs/projects/<app>/environment.md`.

## Best practices (for humans and agents)

Doctrine for conversation design — separate from this runtime handbook:

| Path | Role |
| --- | --- |
| [`docs/best-practices/`](./docs/best-practices/) | Guides: one CTA, Nodes/listens, identity/PII, **debugging/observability**, doc layers |
| [`agent/AGENTS.md`](./agent/AGENTS.md) | Canonical agent entry |
| `agent/cursor/vapi-studio-best-practices.mdc` | Copied into each app’s `.cursor/rules/` on install |

When doctrine changes, update the guides in the **same** change. When runtime contracts change, update **this document**.

## Tests

```bash
yarn test   # tsc + node:test under test/*.test.mjs
```

Mocked unit tests; no live Vapi or paid Brain unless a future eval slice says so.

## Out of scope (current MVP)

Multi-process runtime registry / production failover, generic CLI app generator, production customer business logic in the framework, default-on ChatGPT, Vapi Evals replacement.

**In scope (PoC):** single-process crash recovery via `restoreAllActive()` and `runtime_state` checkpointing — not multi-node HA.
