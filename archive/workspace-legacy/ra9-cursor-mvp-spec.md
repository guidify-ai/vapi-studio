# RA9 — Framework Concept & Roofr Vapi PoC Initiation Specification

**Status:** Draft / Initiation Spec  
**Purpose:** Input document for SpecKit planning and implementation  
**Primary implementation language:** TypeScript  
**Runtime:** Node.js + NestJS  
**Deployment:** Docker, backend-only  
**Initial adapter:** Vapi Custom LLM  
**Initial proving ground:** Roofr Vapi account, used only for a private technical PoC  
**RA9 visibility:** Closed-source/private framework

---

## 1. Executive Summary

RA9 is a private, code-first framework for **rapid application development of stateful conversational bots**.

RA9 is not intended to be a no-code bot builder and is not initially intended to be an end-user SaaS product. It is an internal engineering framework used to build custom bots quickly, consistently, and safely.

A bot built with RA9 is a normal NestJS backend application following an opinionated project structure, similar in spirit to Laravel:

- the framework provides runtime behavior, contracts, orchestration, persistence abstractions, adapters, events, and conventions;
- the application developer writes the actual bot in TypeScript;
- bot-specific Nodes, business rules, integrations, prompts, services, and domain code live in the bot application;
- NestJS dependency injection is a first-class part of the programming model;
- a small YAML flow schema describes **conversation paths**, not implementation details;
- external channels such as Vapi are implemented through adapters;
- the bot application does not need to know the wire protocol of Vapi, OpenAI, HTTP streaming, or another transport.

The first RA9 use case is a **Vapi Custom LLM Adapter**. Vapi will treat the RA9 application as an OpenAI-compatible custom model endpoint. RA9 will receive conversation context from Vapi, execute the current conversational Node, and compile RA9 output into the format expected by Vapi.

The first implementation is deliberately a small Roofr PoC. It is not intended to solve Roofr's production business problem. Its purpose is to experimentally verify the assumptions on which RA9 depends.

### Related inspiration

**[Dograh](https://github.com/dograh-hq/dograh)** ([docs](https://docs.dograh.com)) is an open-source, self-hostable voice-agent platform positioned as an alternative to Vapi and Retell. They successfully recreated the Vapi-class product surface (visual workflow graph, telephony, BYOK LLM/STT/TTS). RA9 is a different bet — private, **code-first** NestJS orchestration rather than a no-code builder — but Dograh is useful prior art: proof that Vapi’s model can be repeated outside the proprietary SaaS, and a practical reference for graph UX (e.g. `@xyflow/react` + dagre on the Roofr PoC `/flow` page).

---

# 2. Product Philosophy

## 2.1 RA9 is a framework, not the bot

RA9 must not contain Roofr-specific behavior.

The relationship is:

```text
RA9 framework
    |
    +-- Supervisor
    +-- Conversation runtime
    +-- Node contracts
    +-- Events
    +-- Memory abstractions
    +-- Output abstractions
    +-- Adapter contracts
    +-- Vapi adapter
    +-- Persistence abstractions
    +-- flow/schema loader
    |
    v
Custom NestJS application
    |
    +-- flow.yaml
    +-- Nodes
    +-- business services
    +-- integrations
    +-- prompts
    +-- application-specific context
    +-- configuration
```

The custom application is code written **on top of RA9**.

The first custom application will be `roofr-poc`.

---

## 2.2 Code-first, not prompt-first

RA9 exists to avoid expressing an entire business process inside one large system prompt.

The desired mental model is:

```text
conversation = application code + explicit flow + AI where useful
```

LLMs are tools available to the application. They are not the orchestration engine.

A Node may use an LLM for:

- intention detection;
- classification;
- extraction;
- response generation;
- summarization;
- interpretation of ambiguous user input.

A Node may also use no LLM at all.

RA9 must allow deterministic code to own:

- business rules;
- transitions;
- integrations;
- state mutation;
- validation;
- error handling;
- side effects;
- termination behavior.

---

## 2.3 NestJS dependency injection is fundamental

RA9 must embrace NestJS rather than hide it.

Nodes are application classes and should be able to inject arbitrary dependencies:

```ts
@Injectable()
export class CheckAvailabilityNode extends Ra9Node {
  constructor(
    private readonly appointments: AppointmentService,
    private readonly crm: CrmService,
    private readonly brain: BrainService,
  ) {
    super();
  }
}
```

This is intentional.

Memory, integrations, AI providers, repositories, analytics, and domain services should be injectable.

RA9 should not build its own parallel dependency container.

---

## 2.4 The framework should feel like Laravel

The developer experience should be opinionated.

The eventual workflow should feel approximately like:

```text
1. obtain/download an RA9 application skeleton
2. install application dependencies
3. configure environment
4. open the known folders
5. define flow.yaml
6. create Nodes
7. create integrations/services
8. run locally
9. deploy
```

A developer should know where to put:

- Nodes;
- flow schemas;
- integrations;
- conversation types/context;
- application configuration;
- prompts;
- tests.

The framework should provide conventions so every RA9 bot has recognizable structure.

For the PoC, the skeleton does not need a package installer or CLI generator yet. The `roofr-poc` project should simply follow the intended future skeleton structure.

---

# 3. Repository / Workspace Model

RA9 is one package inside a broader private package family named **Guidify AI**.

`guidify-ai` is intended to become the home for multiple reusable AI/backend packages over time. RA9 is the first package, but the repository/package family must not be named or structured as if RA9 will always be the only component.

The PoC workspace should therefore contain two independent top-level codebases:

```text
workspace/
|
+-- guidify-ai/
|   +-- package.json
|   +-- packages/
|   |   +-- ra9/
|   |       +-- package.json
|   |       +-- src/
|   |       +-- test/
|   |       +-- ...
|   |
|   +-- ...future Guidify AI packages...
|   +-- ...
|
+-- roofr-poc/
    +-- package.json
    +-- src/
    +-- config/
    +-- test/
    +-- Dockerfile
    +-- docker-compose.yml
    +-- .env.example
    +-- ...
```

These are logically separate repositories/codebases.

After the experiment:

- `guidify-ai/` becomes the private package repository / package family;
- RA9 lives inside `guidify-ai/packages/ra9`;
- `roofr-poc/` remains a separate installable application/use-case repository.

The Roofr PoC must consume RA9 through `package.json` as a **local filesystem dependency**, rather than importing framework source files directly.

Illustrative form:

```json
{
  "dependencies": {
    "@guidify-ai/ra9": "file:../guidify-ai/packages/ra9"
  }
}
```

Exact package names may be refined during planning, but the namespace concept is intentional:

```text
@guidify-ai/ra9
@guidify-ai/<future-package>
@guidify-ai/<future-package>
```

Important architectural rule:

> The Roofr application must interact with RA9 only through the public package API.

It must not reach into private framework internals.

---

## 3.1 `guidify-ai` package family

`guidify-ai` is not itself the bot application skeleton.

It is the reusable package family.

RA9 is the first reusable runtime/framework package:

```text
guidify-ai
    |
    +-- @guidify-ai/ra9
    |
    +-- future reusable AI packages
```

Future packages are intentionally unspecified.

The initiation spec must not invent speculative packages merely to fill the monorepo.

---

## 3.2 Application skeleton model

`roofr-poc` represents the **future RA9 application skeleton**.

The mental model should be similar to `laravel/laravel`:

```text
framework/package ecosystem
        |
        v
install/download application skeleton
        |
        v
application is already wired with framework dependencies
        |
        v
developer writes application-specific files
```

In other words:

```text
@guidify-ai/ra9 ~= framework package
roofr-poc       ~= example of the future installable RA9 application skeleton
```

Eventually, a new developer should not manually assemble NestJS + RA9 + Docker + persistence every time.

They should obtain an application skeleton that already contains:

- NestJS;
- RA9 dependency;
- required Guidify AI dependencies;
- standard folder structure;
- application bootstrap;
- RA9 module registration;
- environment configuration;
- Dockerfile;
- `docker-compose.yml`;
- PostgreSQL service;
- HTTP port convention;
- example flow;
- example Node;
- migration/bootstrap path;
- test setup.

The developer should then mostly remove/replace example-use-case files and start writing the real bot.

For the first PoC, `roofr-poc` itself should be built in this style so it can later inform the real reusable skeleton.

---

# 4. High-Level Domain Model

RA9 is centered around these concepts:

```text
Conversation
    |
    v
Supervisor
    |
    v
Current Node
    |
    +--> application services / integrations
    +--> Brain / LLM services
    +--> Memory
    +--> Events
    +--> Output
    |
    v
Transition / terminal result
```

Core concepts:

1. `Conversation`
2. `ConversationContext`
3. `Supervisor`
4. `Node`
5. `FlowDefinition`
6. `Event`
7. `EventService`
8. `Memory`
9. `Brain`
10. `Integration / application services`
11. `Input Adapter`
12. `Output Adapter`
13. `Channel metadata`
14. `Turn`
15. `Interrupt`
16. `Conversation termination`

These concepts must be defined independently from Vapi wherever practical.

---

# 5. Conversation

## 5.1 Definition

A `Conversation` is a long-lived logical interaction.

Examples:

```ts
Conversation<PhoneCallContext>
Conversation<WebChatContext>
Conversation<HttpConversationContext>
Conversation<MyCustomContext>
```

The generic context is application/channel-specific data.

Examples of possible context data:

- provider call ID;
- caller phone number;
- customer ID;
- channel metadata;
- arbitrary values supplied when the conversation is created;
- information accumulated during execution.

RA9 must not restrict conversation context to a fixed universal shape beyond framework-required metadata.

---

## 5.2 Channel and flow are separate concepts

The flow schema must **not** say:

```yaml
type: phoneCall
```

A flow describes the conversational path.

The channel through which the user reached RA9 is runtime metadata.

The same conceptual flow may eventually be used by:

- voice;
- web chat;
- another HTTP-driven channel;
- a future custom adapter.

Nodes are allowed to inspect channel metadata if business behavior truly depends on the channel.

---

## 5.3 Conversation identity

Every Conversation must have an RA9-generated unique identifier.

Adapters may additionally associate external identifiers, for example:

```text
RA9 Conversation ID
        <->
Vapi Call ID
```

External IDs must not replace the RA9 Conversation ID.

---

## 5.4 Conversation lifecycle

Conceptual states should include at minimum:

```text
CREATED
ACTIVE
WAITING_FOR_INPUT
RUNNING
ENDING
ENDED
FAILED
```

The exact enum may be refined during implementation.

For the initial RA9 runtime model, an **active call Conversation is intentionally long-lived in application memory**.

The important PoC hypothesis is:

> `assistant-request` creates a supervised in-memory Conversation process/object that remains alive across multiple subsequent Custom LLM HTTP requests for the lifetime of the call.

This is not a new OS process, PM2 process, worker, or Docker container per call.

It is a long-lived in-memory RA9 runtime object owned by the NestJS application process.

Conceptually:

```text
NestJS application process
    |
    +-- SupervisorRegistry
            |
            +-- call A -> SupervisedConversation instance
            +-- call B -> SupervisedConversation instance
            +-- call C -> SupervisedConversation instance
```

The PoC must verify that repeated HTTP requests for one Vapi call resolve to the **same in-memory supervised Conversation**, not to a newly reconstructed runtime object on every turn.

PostgreSQL is not the primary turn-by-turn runtime state store for an active call.

PostgreSQL stores durable Conversation information and long-term history, especially after the call ends.

---

# 6. Persistence and Event History

## 6.1 Long-term target

The intended production design uses PostgreSQL.

There are two related persistence concepts.

### Conversation record

A primary Conversation record stores current/retrieval-oriented data such as:

- RA9 Conversation ID;
- status;
- current Node;
- flow/version identifier;
- created timestamp;
- updated timestamp;
- ended timestamp;
- channel metadata or references;
- serialized application context when appropriate;
- optimistic concurrency/version information if needed.

### Event history

Everything meaningful that happens during the Conversation should be representable as an event.

Examples:

```text
ConversationCreated
ConversationStarted
InputReceived
NodeStarted
NodeCompleted
NodeInterrupted
OutputEmitted
MemoryChanged
TagAdded
IntegrationRequested
IntegrationCompleted
IntentDetected
TransitionSelected
ConversationEnding
ConversationEnded
ConversationFailed
```

The sum of events is the complete historical record of the Conversation.

This enables:

- debugging;
- replay;
- analytics;
- auditability;
- future state reconstruction;
- understanding interrupted outputs;
- understanding exactly why a transition occurred.

---

## 6.2 Event Service

RA9 should provide a central Event Service responsible for:

1. recording events;
2. dispatching events to interested listeners;
3. associating events with a Conversation;
4. ordering events;
5. attaching timestamps;
6. eventually persisting events;
7. exposing hooks for analytics/observability.

Application code should not directly write event rows.

Illustrative API:

```ts
await this.events.record(
  new NodeCompleted({
    conversationId,
    nodeId,
  }),
);
```

A Node interrupted during execution must still have an explicit event outcome. Interruption must not make the history ambiguous.

---

## 6.3 PoC persistence

The Roofr PoC must use PostgreSQL, but PostgreSQL and in-memory state have **different responsibilities**.

### In-memory runtime state

While a call is active, the source of truth for fast-changing conversational runtime state is the in-memory supervised Conversation.

Examples:

- current Node;
- current turn;
- mock Brain sequence index;
- `transferToHuman.reengagementAttempts`;
- transient Memory values;
- currently executing Node;
- current output/interrupt state;
- other short-lived call state.

This is intentional.

The PoC must prove that one Conversation can remain alive in memory across multiple independent Custom LLM HTTP requests.

### PostgreSQL durable state

PostgreSQL stores durable Conversation information such as:

- RA9 Conversation ID;
- Vapi call ID / provider correlation ID;
- created timestamp;
- provider metadata;
- high-level status;
- ended timestamp;
- final/frozen Conversation state;
- event/history data intended to survive after the call;
- enough metadata for audit/debugging.

For the PoC, PostgreSQL does **not** need to persist every mutation synchronously during the active call.

The desired lifecycle is approximately:

```text
assistant-request
    |
    +--> create durable Conversation record in PostgreSQL
    |
    `--> create in-memory SupervisedConversation

during call
    |
    +--> runtime state primarily changes in memory
    +--> selected events/logs may be persisted if useful
    `--> PostgreSQL remains durable identity/history store

status-update: ended
    |
    +--> finalize in-memory Conversation
    +--> persist final state/history to PostgreSQL
    +--> mark Conversation ENDED
    `--> remove supervised Conversation from memory
```

This distinction is a core PoC requirement.

The experiment is intentionally testing whether long-lived in-memory supervised Conversations are practical and reliable for active calls.

Production crash recovery / reconstruction of an active Conversation after process restart is a later concern and must not be solved prematurely in this PoC.

# 7. Flow Definition

## 7.1 Purpose of YAML

YAML describes **paths between Nodes**.

It does not describe:

- Vapi;
- HTTP;
- tool implementations;
- CRM APIs;
- calendar APIs;
- NestJS providers;
- business logic internals.

The schema should remain intentionally small.

---

## 7.2 Exactly one start Node

Every flow must declare exactly one start Node.

Illustrative shape:

```yaml
flow:
  id: default

  start: greeting

  nodes:
    greeting:
      next:
        default: handle-request

    handle-request:
      next:
        default: processing

    processing:
      next:
        default: interrupt-test

    interrupt-test:
      next:
        default: goodbye

    goodbye:
      terminal: true
```

This exact YAML is illustrative only.

SpecKit should propose the smallest useful schema consistent with these requirements.

---

## 7.3 No dead-end Nodes

A non-terminal Node must never become a dead end.

Every possible execution path must result in one of:

- transition to another Node;
- conversation termination;
- explicit framework/application error handling.

Flow validation should eventually be able to detect obvious invalid graphs before runtime.

At minimum:

- exactly one start Node;
- all referenced Nodes exist;
- terminal Nodes are explicitly terminal;
- non-terminal Nodes have a valid continuation policy.

---

## 7.4 Integrations do not belong in the flow schema

Example concept such as:

```text
AppointmentAvailabilityRequested
```

should not be declared in YAML merely because a Node uses appointment availability.

A Node gets an application integration through DI:

```ts
@Injectable()
export class AskForAppointmentNode extends Ra9Node {
  constructor(
    private readonly appointments: AppointmentService,
  ) {}
}
```

This is a deliberate RA9 design choice.

YAML controls graph structure.

TypeScript controls behavior.

---

# 8. Node

## 8.1 Definition

A Node is the primary executable unit of a Conversation flow.

The best mental model is:

> A Node represents everything the bot does between user turns.

A Node may:

- inspect current user input;
- inspect Conversation context;
- read Memory;
- mutate Memory;
- call integrations;
- use the Brain;
- record events;
- emit one or more intermediate speech outputs;
- select a transition;
- end the Conversation.

A Node is not required to be a tiny one-line action.

---

## 8.2 One user turn, one Node execution

The normal rhythm is:

```text
USER INPUT
    |
    v
Supervisor resumes Conversation
    |
    v
Current Node executes
    |
    +--> actions
    +--> intermediate output
    +--> integrations
    +--> decisions
    |
    v
terminal conversational action
    |
    +--> SAY AND LISTEN
    |
    `--> END CALL
```

After `sayAndListen`, execution of the current Node is complete.

The channel returns to listening.

The next user input begins the next turn and resumes the Conversation at the appropriate next Node.

---

## 8.3 Multiple actions inside one Node

Multiple actions are explicitly allowed.

Example:

```ts
async run(ctx: NodeContext): Promise<NodeResult> {
  await ctx.output.say(
    'I heard you. Give me a moment while I check something.',
  );

  const customer = await this.crm.findCustomer(ctx.input);

  await ctx.output.say(
    'Got it. I found some data.',
  );

  const result = await this.service.calculate(customer);

  return ctx.output.sayAndListen(
    `Here is the result: ${result}`,
  );
}
```

This is one Node because no new user turn occurs between these actions.

---

## 8.4 Terminal action invariant

A successfully executing Node must ultimately finish in an explicit terminal conversational action.

For the initial framework concept:

```text
sayAndListen(...)
endCall(...)
```

Future terminal actions may include:

```text
transfer(...)
handoff(...)
```

But they are not required for the first PoC unless needed to support Vapi call termination.

Intermediate `say(...)` is **not terminal**.

---

## 8.5 `say`, `sayAndListen`, and `endCall`

### `say(text)`

Meaning:

> Emit this text to the current channel now, but continue executing the current Node.

Typical use:

```text
"I heard you, let me check that."
"Got it."
"One more moment."
```

A Node may call `say` multiple times.

### `sayAndListen(text)`

Meaning:

> Emit the final text for this Node, complete the current assistant turn, and return control to the channel so it listens for the next user input.

This is a terminal Node action.

### `endCall(text?)`

Meaning:

> Optionally emit a farewell and terminate the voice Conversation/call.

This is terminal.

The framework-level abstraction should eventually be generalized beyond the word "call", but the Vapi PoC may expose voice-oriented semantics first if necessary.

---

# 9. Output Abstraction

RA9 Nodes must not know about:

- SSE;
- Express/Fastify Response objects;
- OpenAI chunk JSON;
- `<flush />`;
- Vapi HTTP endpoints.

Nodes speak through an RA9 abstraction.

Illustrative interface:

```ts
export interface ConversationOutput {
  say(text: string): Promise<void>;

  sayAndListen(text: string): Promise<NodeResult>;

  endCall(text?: string): Promise<NodeResult>;
}
```

The exact return types should be designed by SpecKit.

The important separation is:

```text
Node
  |
  v
RA9 ConversationOutput
  |
  v
Channel Adapter
  |
  v
Provider protocol
```

---

# 10. Input and Channel Adapters

## 10.1 Adapter responsibility

Adapters translate provider-specific transport into RA9 concepts and RA9 output back into provider-specific transport.

The first implementation is Vapi.

Future possibilities may include:

- web chat;
- direct HTTP;
- another voice provider;
- custom websocket transport.

RA9 core must not be tightly coupled to Vapi.

---

## 10.2 Vapi Custom LLM Adapter

For the first adapter, Vapi calls an RA9-backed HTTP endpoint as a Custom LLM.

Vapi expects an endpoint compatible with the OpenAI client and recommends support for streaming completions. The RA9 Vapi adapter therefore owns the provider-specific mapping between:

```text
Vapi/OpenAI-compatible request
        <->
RA9 Input / Conversation / Turn

RA9 output
        <->
OpenAI-compatible SSE response
```

Vapi provider behavior is an adapter concern.

Official reference:
- https://docs.vapi.ai/customization/custom-llm/using-your-server
- https://docs.vapi.ai/customization/tool-calling-integration
- https://docs.vapi.ai/customization/custom-llm/fine-tuned-openai-models

---

## 10.3 Vapi streaming output

The Custom LLM HTTP request may remain open while RA9 executes a Node.

The Vapi adapter can stream output chunks through the HTTP response.

Conceptually:

```text
Vapi POST /chat/completions
        |
        v
RA9 executes Node
        |
        +--> say("Let me check...")
        |       |
        |       `--> SSE chunk + provider flush behavior
        |
        +--> await slow integration
        |
        +--> say("Got it...")
        |       |
        |       `--> SSE chunk + provider flush behavior
        |
        +--> await another action
        |
        `--> sayAndListen("Here is the result...")
                |
                +--> final content
                +--> stream completion
```

Vapi provides flush syntax for forcing accumulated streamed output toward the voice provider before the entire model response is complete.

Official reference:
- https://docs.vapi.ai/assistants/voice-formatting-plan
- Vapi documentation for flush syntax linked from voice formatting documentation

The implementation must verify actual behavior experimentally rather than assuming exact timing.

---

# 11. Input / User Messages

For each new user turn, Vapi is expected to invoke the Custom LLM endpoint with conversation/model context in an OpenAI-compatible request.

RA9 should not assume that the incoming request payload itself is the canonical Conversation state.

The adapter should:

1. inspect/log the complete provider request for the PoC;
2. extract provider metadata needed to correlate the call;
3. obtain or create the RA9 Conversation;
4. determine the user input associated with the turn;
5. pass normalized input to the Supervisor.

The PoC should deliberately retain raw request logging so the real Vapi payload can be studied.

Sensitive credentials must never be logged.

---

# 12. Supervisor

## 12.1 Responsibility

The Supervisor is the runtime orchestrator of a Conversation.

It should own:

- Conversation lifecycle;
- locating the current Node;
- executing the Node;
- turn boundaries;
- transitions;
- maximum-turn safeguards;
- interruption handling;
- terminal behavior;
- lifecycle events;
- state commit rules.

The Node should not orchestrate the entire graph itself.

---

## 12.2 Logical long-lived process

Conceptually:

> one Conversation has one Supervisor coordinating its lifetime.

This does **not** require one permanently alive Node.js process/object for each Conversation.

The production design should permit the Supervisor to be reconstructed/resumed from persisted Conversation state.

For the PoC, an in-memory supervisor/session registry is acceptable.

---

## 12.3 Turn limit

The Supervisor must have protection against accidental infinite conversations / graph loops.

There should be configurable limits such as:

```text
maximum total conversation turns
maximum internal transitions per input, if internal transitions are introduced
maximum Node runtime / timeout
```

Exact defaults should be proposed by SpecKit.

For the PoC, a simple small turn cap is sufficient.

---

# 13. State Machine

RA9 is intentionally a step-based / turn-based state machine.

Conceptual model:

```text
Conversation has currentNode

user input arrives
        |
        v
currentNode.run(...)
        |
        v
actions / AI / tools / output
        |
        v
terminal result
        |
        +--> nextNode + listen
        |
        `--> end
```

The flow graph determines allowable movement.

Node code determines the outcome of the current step.

---

# 14. Intention / Brain Service

## 14.1 Purpose

RA9 must expose a first-class `BrainService`.

The Brain is not the flow engine and does not own transitions directly. It is an injectable reasoning capability used by the Supervisor and/or Nodes to understand user input.

Example:

```ts
const intentions = await this.brain.scanIntentions({
  conversation,
  input: ctx.input,
  currentNode: ctx.node,
});
```

Other future Brain capabilities may include structured extraction, classification, response generation, summarization, free-text interpretation, and semantic validation.

The Brain must be replaceable and mockable.

---

## 14.2 Intention scanning is part of the turn lifecycle

For RA9, an intention scan is not merely an optional helper used by individual Nodes.

The architectural target is:

> After RA9 receives/listens to a new user turn, the Supervisor performs an intention scan before normal Node behavior proceeds.

Conceptually:

```text
USER INPUT
    |
    v
Input Adapter
    |
    v
Supervisor
    |
    v
Brain.scanIntentions(...)
    |
    +--> global / portal intentions
    |
    +--> node/flow-relevant intentions
    |
    v
execute/resume current Node
```

This allows RA9 to detect intentions that should work regardless of the current Node, such as:

```text
transferToHuman
endConversation
repeat
help
```

The exact global intention set is application-defined.

---

## 14.3 Mock Brain mode is required for the PoC

The first PoC must not depend on a real LLM producing stable intent classifications.

RA9 must provide a deterministic/mock Brain implementation.

The mock Brain should be configurable to return intentions in a predefined sequence.

Illustrative concept:

```ts
MockBrain([
  { isAcknowledge: true },
  { isMultiSayTest: true },
  { isInterruptTest: true },
  { isGoodbye: true },
]);
```

or:

```ts
[
  'isAcknowledge',
  'isMultiSayTest',
  'isInterruptTest',
  'isGoodbye',
]
```

The exact API is not prescribed.

The requirement is:

> Every new user input advances the mock scanner to the next configured intention result.

This allows the PoC to prove the complete RA9 intention-driven lifecycle without depending on model quality.

The mock implementation must still go through the same `BrainService` interface that a real implementation would later use.

---

## 14.4 Intention results

RA9 should favor structured intention results rather than raw strings leaking everywhere.

Illustrative shape:

```ts
interface IntentionScanResult {
  intentions: Record<string, boolean>;
}
```

Example:

```json
{
  "intentions": {
    "isTransferToHuman": false,
    "isAcknowledge": true,
    "isGoodbye": false
  }
}
```

The exact type can be improved by SpecKit.

---

## 14.5 Intention scan events

Every scan should eventually be observable as events.

Conceptually:

```text
IntentionScanStarted
IntentionDetected
IntentionScanCompleted
```

At minimum, PoC logs should show:

- user turn;
- mock Brain call;
- returned intention(s);
- whether a global portal intercepted the normal flow;
- which Node ultimately executed.

This establishes the runtime order:

```text
input
-> scan
-> global policy
-> Node
-> output
```

# 15. Memory

RA9 should distinguish application state from provider conversation history.

Memory may include:

- values collected from the user;
- normalized entities;
- IDs returned by integrations;
- tags;
- decisions;
- transient workflow values.

Example:

```ts
await ctx.memory.set('serviceAddress', address);
const address = await ctx.memory.get<string>('serviceAddress');
```

Memory mutations should eventually produce events.

The implementation should not force every application to use a global untyped dictionary forever. Typed or domain-specific context should remain possible.

---

# 16. Integrations and Tools

Integrations are code.

Examples:

```text
CRM service
appointment service
internal API
payment service
identity service
property lookup
custom application repository
```

They belong in the bot application and are injected into Nodes.

Example:

```ts
@Injectable()
export class AvailabilityService {
  async findSlots(...): Promise<Slot[]> {
    // anything:
    // HTTP
    // DB
    // SDK
    // queue
    // filesystem
    // proprietary protocol
  }
}
```

RA9 must not assume integrations are HTTP calls.

This flexibility is a core reason for a code-first framework.

---

# 17. Errors

A conversational flow must not silently die.

Potential failure types:

- integration failure;
- invalid Node result;
- missing transition;
- provider disconnect;
- timeout;
- unknown Conversation;
- state conflict;
- adapter error;
- Brain failure.

Long-term framework behavior should support:

- error events;
- configurable error Node / fallback policy;
- safe user-facing failure behavior;
- terminal failure handling.

For the PoC, errors may be logged and converted into a deterministic fallback response, as long as failure is visible.

---

# 17.1 Global Conversation Portals

RA9 should support **global conversational portals**.

A portal is a framework/application-level behavior that can intercept a user turn regardless of the current Node.

It is not a provider webhook and it is not necessarily a Node in the normal YAML flow.

It is better understood as:

> a high-priority conversational policy triggered by an intention.

The first portal to prove is:

```text
transferToHuman
```

---

## 17.2 `transferToHuman` portal

The `transferToHuman` portal handles a user's request to speak with a human.

It must be stateful.

PoC policy:

```text
first request for human
        |
        v
attempt re-engagement
        |
        v
return to listening

second request for human
        |
        v
transfer to human
```

The first request must not immediately transfer.

RA9 should say:

> I understand you want to speak to a human, but I can resolve it for you.

Then RA9 listens again.

If the next relevant user turn asks for a human again, RA9 must execute a real transfer.

---

## 17.3 Portal state

The portal must keep enough state to know whether re-engagement has already been attempted.

For an active call this state belongs to the **in-memory supervised Conversation**.

Illustrative runtime Conversation state:

```json
{
  "portals": {
    "transferToHuman": {
      "reengagementAttempts": 1
    }
  }
}
```

Requirements:

- the count survives across multiple Custom LLM HTTP requests because the supervised Conversation remains alive in memory;
- it belongs to the active RA9 Conversation runtime;
- the second human request can be distinguished from the first;
- final portal state/history may be persisted to PostgreSQL when the call is finalized.

This is deliberately an **in-memory continuity test** for the PoC.

---

## 17.4 Portal precedence

The intended ordering for each user input is:

```text
InputReceived
    |
    v
Brain.scanIntentions()
    |
    v
Does a global portal match?
    |
    +-- YES --> execute portal policy
    |              |
    |              +--> re-engage + listen
    |              `--> transfer/end/etc.
    |
    `-- NO ----> continue normal current Node
```

For the PoC, `transferToHuman` has higher precedence than the normal flow.

---

## 17.5 Portal and normal Node relationship

A portal may consume the complete user turn.

Example:

```text
currentNode = SomeNormalNode

user: "I want a person"
        |
        v
Brain => isTransferToHuman
        |
        v
transferToHuman portal
        |
        v
sayAndListen(
  "I understand you want to speak to a human, but I can resolve it for you."
)
```

`SomeNormalNode` should not execute for that user turn.

The Conversation may keep `currentNode = SomeNormalNode` so that if the user re-engages with the bot, the normal flow can resume.

This is important:

> Portal execution can temporarily intercept the conversation without necessarily advancing the normal YAML flow.

---

## 17.6 Vapi transfer implementation

The semantic RA9 action should be provider-neutral:

```text
TransferToHuman
```

For Vapi, the adapter should compile that action to Vapi's built-in `transferCall` capability.

Official references:

- https://docs.vapi.ai/call-forwarding
- https://docs.vapi.ai/tools/default-tools
- https://docs.vapi.ai/calls/call-dynamic-transfers

The PoC should configure one safe test destination for transfer.

The destination must come from environment/Vapi configuration and must never be hard-coded in the framework.

---

# 18. Interruptions

Interruptions are a first-class future concept.

Voice creates a special case:

```text
RA9 starts speaking
    |
    v
Vapi/TTS is producing output
    |
    v
user interrupts
```

The framework must eventually understand:

- what Node was executing;
- which output/turn was interrupted;
- whether the Node already performed side effects;
- what state was committed;
- what the user said after interrupting;
- how execution resumes.

Vapi exposes a `user-interrupted` server event among supported server messages.

Official reference:
- https://docs.vapi.ai/server-url/events
- https://docs.vapi.ai/api-reference/assistants/update

The Roofr PoC must log this event so its actual shape and timing can be observed.

The first PoC does not need a production-grade interruption recovery algorithm.

Its goal is to answer:

> Can RA9 correlate the interruption with the ongoing call/turn and continue the Conversation correctly?

---

# 19. Vapi End Call

The PoC must prove that RA9 can deliberately end the call.

Vapi provides an `endCall` tool.

Official reference:
- https://docs.vapi.ai/tools/default-tools
- https://docs.vapi.ai/api-reference/tools/create

The implementation should experimentally determine the cleanest way for the Vapi adapter to compile an RA9 `endCall(...)` outcome into the Vapi/OpenAI-compatible custom LLM stream/tool-call format.

This provider mapping must remain inside the Vapi adapter.

RA9 core should express intent:

```text
END CONVERSATION
```

The Vapi adapter expresses provider mechanics:

```text
Vapi endCall tool call
```

---

# 19.1 Vapi `assistant-request` as Conversation Bootstrap

For the first Vapi use case, RA9 should use Vapi's `assistant-request` Server URL message as the **bootstrap event for an inbound call Conversation**.

Vapi documents the inbound message shape conceptually as:

```json
{
  "message": {
    "type": "assistant-request",
    "call": {
      "...": "Call Object"
    }
  }
}
```

The Vapi Call Object contains the provider call identity. The PoC should initially expect the correlation value to be available as:

```text
message.call.id
```

but must log and confirm the real payload during the first test call rather than hard-coding assumptions without observation.

Official references:

- https://docs.vapi.ai/server-url/events
- https://docs.vapi.ai/server-url
- https://docs.vapi.ai/server-url/setting-server-urls

---

## 19.2 Required Vapi phone-number configuration

For `assistant-request` to be used for inbound assistant resolution, the test phone number must **not** have a fixed `assistantId` directly assigned to it.

Vapi documents that when a phone number has no `assistantId`, it may request the assistant dynamically from the configured Server URL.

Therefore the PoC topology is:

```text
Inbound call
    |
    v
Vapi phone number
(no directly assigned assistantId)
    |
    v
POST /vapi/events
type = assistant-request
    |
    v
RA9 creates Conversation in PostgreSQL
    |
    v
RA9 returns saved PoC assistantId
    |
    v
Vapi starts that assistant
    |
    v
assistant uses RA9 Custom LLM endpoint
```

A single dedicated saved Vapi assistant should still exist for the PoC.

The distinction is:

```text
assistant exists in Vapi
BUT
phone number does not statically bind to it
```

RA9 selects/returns that assistant during `assistant-request`.

---

## 19.3 `assistant-request` response

The PoC should prefer returning the ID of a pre-created saved Vapi assistant:

```json
{
  "assistantId": "<POC_ASSISTANT_ID>"
}
```

rather than constructing a large transient assistant definition on every call.

This keeps the bootstrap endpoint fast and makes Vapi configuration easier to inspect manually.

The assistant should already be configured to use:

```text
RA9 Custom LLM URL:
https://<ngrok-host>/vapi/chat/completions
```

and the necessary server messages/tools for the PoC.

---

## 19.4 Hard latency requirement

Vapi documents a fixed end-to-end timeout of approximately **7.5 seconds** for `assistant-request`.

Therefore this handler must do minimal synchronous work.

Required synchronous sequence:

```text
receive assistant-request
        |
        v
extract call metadata
        |
        v
create Conversation record
        |
        v
commit PostgreSQL transaction
        |
        v
initialize lightweight runtime state if needed
        |
        v
return assistantId
```

Do not perform:

- external AI calls;
- slow enrichment;
- unnecessary provider calls;
- long setup workflows

inside this webhook.

The target should be well below the Vapi timeout.

---

## 19.4.1 Live Custom LLM turns must be fast

`assistant-request` is bootstrap. **Every later Custom LLM request is a live conversational turn.** Silence on the phone while RA9 waits is worse than a slightly imperfect extract.

Hard rules for `/vapi/chat/completions`:

- Start Brain `scan` immediately on the user text already in the request. Do **not** hold, sleep, or debounce the HTTP response to "catch more ASR" when the Brain is ChatGPT.
- **Exception — uninterruptible listen:** when `listenExpectation.interruptible === false` (address dictation), overlapping Custom LLM POSTs MUST be queued and held until **~3 seconds of silence** after the last fragment, then scanned once as a combined utterance. Do not abort that listen as barge-in.
- Open the SSE stream as soon as the call is correlated; do not wait on OpenAI before sending response headers.
- **Speak on the HTTP request Vapi still has open.** Later Custom LLM POSTs must run (or replay last speech) on their own SSE. Do not drain them onto an older connection and complete the new one with empty content — that is dead air until the caller says “hello.”
- **Target:** first assistant speech chunk on the SSE stream in **under 1.5 seconds** after request receipt (p95), excluding TTS playback and Docker/process cold start.
- Brain OpenAI HTTP MUST **abort at 3 seconds**. On timeout or error, route `ra9.isUnknownTransition` / re-ask — never leave the caller in dead air waiting for a hung model.
- Keep scan prompts compact (rolling history window, no unused callbacks or fat dumps).
- Mock Brain may still coalesce split ASR crumbs with a listen hold. Live ChatGPT MUST NOT hold except on an uninterruptible listen (address).

This is a live conversation. Be fast.

---

## 19.4.2 Shit in, shit out

Stay fast so Vapi is less likely to retry. **Do not treat Vapi stale repeats as a conversation to interpret.**

Vapi may POST the same Custom LLM turn again (duplicate user text, `CUSTOM_LLM_TURN_QUEUED`, replay of the last name while the next question is already pending). That is a **provider** artifact. It is not “the caller confirmed the phone” and it is not a reason to add Brain prompt clauses or Node recovery graphs.

Garbage in, garbage out:

- Messy ASR, empty crumbs, and weird callers happen. The bot does not have to handle them all.
- `ra9.isUnknownTransition` / re-ask the current question is enough.
- A bad extract from a bad utterance is acceptable. Do not add “if they repeated the previous field…” rules to scan prompts or Nodes.

Happy-path intake is in scope. Perfect robustness against Vapi retries and odd people is not.

---

## 19.5 Conversation creation semantics

On a new `assistant-request`, RA9 should create a Conversation approximately like:

```text
Conversation
  id                = RA9-generated UUID
  provider          = vapi
  providerCallId    = message.call.id
  status            = CREATED / ACTIVE
  currentNode       = flow.start
  flowId            = configured Roofr PoC flow
  metadata          = selected sanitized Vapi call metadata
  createdAt         = now
```

A uniqueness rule should prevent accidental duplicate Conversations for the same provider call.

Conceptually:

```text
UNIQUE(provider, providerCallId)
```

If Vapi retries the `assistant-request`, the handler should be idempotent:

- find the existing Conversation;
- do not create a duplicate;
- return the same configured assistant ID.

---

## 19.6 "Start a process for the call"

For the RA9 PoC, **start a process for the call** means:

> create and register a long-lived in-memory `SupervisedConversation` instance for that call.

It does **not** mean:

- spawn a new OS process;
- start a new PM2 worker;
- create one Docker container per call.

The expected runtime model is:

```text
assistant-request
      |
      v
create Conversation record in PostgreSQL
      |
      v
create SupervisedConversation in memory
      |
      v
register by Vapi call ID / RA9 Conversation ID
      |
      v
return assistantId
```

Then later:

```text
Custom LLM request #1
      |
      v
find existing SupervisedConversation in registry
      |
      v
Supervisor handles turn
      |
      v
LISTEN

Custom LLM request #2
      |
      v
find SAME SupervisedConversation object
      |
      v
Supervisor handles next turn
```

The PoC must explicitly verify object/runtime continuity.

For example, logs may include a generated runtime instance ID:

```text
conversationId = <stable RA9 id>
runtimeInstanceId = <stable in-memory instance id>
```

The same `runtimeInstanceId` should appear for every turn of one active call.

### Runtime registry

RA9 should have a process-local registry conceptually similar to:

```ts
interface SupervisedConversationRegistry {
  create(...): SupervisedConversation;
  getByProviderCallId(callId: string): SupervisedConversation | undefined;
  removeByProviderCallId(callId: string): void;
}
```

The exact API is for SpecKit to design.

### Missing in-memory Conversation

For the PoC, if a Custom LLM request references a persisted Conversation but the in-memory supervised instance is unexpectedly missing, this should be treated as an explicit exceptional condition and logged loudly.

The PoC should **not silently reconstruct** the active runtime from PostgreSQL because that would hide whether the long-lived in-memory model actually works.

Crash recovery/reconstruction is a future production feature.

## 19.7 Custom LLM correlation requirement

One of the first experiment questions is whether the Vapi Custom LLM request provides the same call metadata / call identity directly and where it appears.

The implementation must not assume this silently.

During the PoC:

1. dump the sanitized `assistant-request`;
2. capture `message.call.id`;
3. dump the sanitized first Custom LLM request;
4. determine the canonical correlation path;
5. document it;
6. implement the Vapi adapter to resolve the persisted RA9 Conversation from that value.

If the Custom LLM request does not contain the call ID in the expected location, the PoC should determine the supported Vapi mechanism for passing/correlating it rather than introducing hidden global state.

---

# 20. Roofr PoC

## 20.1 Objective

The Roofr PoC is a disposable but well-structured technical experiment.

It contains **two deterministic call scenarios**.

Together they must prove or disprove the following assumptions:

1. RA9 can receive Vapi `assistant-request` and Custom LLM requests.
2. RA9 can create and persist a Conversation before assistant turns begin.
3. RA9 can correlate multiple Custom LLM requests to one Conversation.
4. Those requests resolve to the same long-lived in-memory `SupervisedConversation` instance.
5. Active conversational state can live in memory across HTTP request boundaries.
6. RA9 can run an intention scan on every user turn.
7. A deterministic/mock Brain can drive a reproducible conversation flow.
8. RA9 can track a state machine across multiple user turns.
9. RA9 can emit a normal spoken response.
10. RA9 can emit multiple spoken pieces during one Node execution.
11. RA9 can deliberately delay between emitted speech pieces.
12. RA9 can observe what happens when the user interrupts the assistant.
13. RA9 can resume after an interruption.
14. A global intention portal can intercept the normal flow.
15. `transferToHuman` can remember that one re-engagement attempt already occurred.
16. The first human request causes re-engagement rather than transfer.
17. The second human request triggers a real Vapi call transfer.
18. RA9 can issue a final farewell in the normal scenario.
19. RA9 can trigger Vapi call termination.
20. Vapi `status-update` events can synchronize provider lifecycle into RA9.
21. `status-update: ended` reliably finalizes the persisted RA9 Conversation.
22. Both exchanges can be logged well enough to inform the production framework design.

Nothing more is required for PoC success.

The PoC intentionally uses a mock Brain because the experiment is about **RA9 mechanics**, not LLM accuracy.


## 20.2 Scenario 1 — State Machine / Multi-Say / Interrupt / End Call

The PoC must **not** contain real Roofr business logic.

It should be deterministic and intentionally simple.

Expected script:

### Call begins

Robot:

> Hi, thanks for calling!

This first greeting may be configured in Vapi or produced by RA9 depending on what produces the clearest experiment. The choice should be documented.

### User turn 1

User says anything.

RA9 should ignore semantic content for this PoC.

Robot:

> Nice, I can help you with that.

Purpose:

- prove Vapi invoked the custom LLM;
- prove RA9 received user/conversation context;
- prove RA9 returned a response;
- prove Conversation state progressed.

### User turn 2

User says anything.

Robot:

> Okay, give me a moment.

Pause deliberately.

Robot:

> Got it, I have some data for you.

Pause deliberately.

Robot:

> Here it is. This proves I can send multiple messages during one turn.

Purpose:

- prove multiple `say(...)` emissions;
- prove delayed work between emissions;
- prove the HTTP/SSE response can remain alive;
- prove final `sayAndListen(...)`.

### User turn 3

User says anything.

Robot begins a deliberately long response:

> I am going to keep talking for a while so that you can interrupt me...

The human caller interrupts while the robot is speaking.

The system must log everything available from Vapi concerning the interruption.

Purpose:

- inspect actual interruption behavior;
- inspect server events;
- inspect the next Custom LLM request after interruption;
- determine whether the interrupted output can be correlated to provider turn IDs.

### After interruption

On the next resumed RA9 turn, semantic input can still be ignored.

Robot:

> Thanks. I saw the interruption. Goodbye.

Then RA9 must request call termination.

---

## 20.3 Scenario 2 — `transferToHuman` Portal

This is a separate call from Scenario 1.

The purpose is to prove:

- intention scanning on every input;
- global portal interception;
- persisted portal state;
- one re-engagement attempt;
- provider-level transfer on the second request.

### Initial setup

The mock Brain for this scenario should produce:

```text
Turn 1 -> isTransferToHuman = true
Turn 2 -> isTransferToHuman = true
```

No real semantic detection is required.

### Greeting

Robot:

> Hi, thanks for calling!

### User turn 1

The human says something equivalent to:

> I want to speak to a human.

Mock Brain returns:

```text
isTransferToHuman = true
```

The global `transferToHuman` portal intercepts the normal flow.

Because:

```text
reengagementAttempts = 0
```

RA9 must:

1. persist `reengagementAttempts = 1`;
2. not call Vapi `transferCall`;
3. respond:

> I understand you want to speak to a human, but I can resolve it for you.

4. complete the turn and listen again.

The current normal-flow Node should not advance solely because the portal handled the turn.

### User turn 2

The human asks for a person again.

Mock Brain again returns:

```text
isTransferToHuman = true
```

The portal now sees:

```text
reengagementAttempts = 1
```

RA9 selects the semantic terminal action:

```text
TransferToHuman
```

The Vapi adapter must compile this into a real Vapi `transferCall` tool invocation.

The call must transfer to the configured test destination.

### Critical experiment point

The PoC should verify whether Vapi:

- performs the transfer immediately when the Custom LLM emits `transferCall`;
- generates another Custom LLM request before/after the transfer;
- sends relevant server events;
- changes active assistant/call state;
- closes the RA9 conversational turn cleanly.

All observed behavior must be logged.

---

## 20.4 Mock Brain profiles

The PoC should support at least two mock Brain profiles.

### Scenario 1 profile

```text
turn 1 -> isAcknowledge
turn 2 -> isMultiSayTest
turn 3 -> isInterruptTest
turn 4 -> isGoodbye
```

### Scenario 2 profile

```text
turn 1 -> isTransferToHuman
turn 2 -> isTransferToHuman
```

A simple environment/config value may choose the active profile.

Example:

```text
RA9_POC_SCENARIO=state-machine
RA9_POC_SCENARIO=transfer-human
```

The mock scanner must still be injected through the same Brain contract intended for real implementations.

---

## 20.5 PoC state machine

A deliberately primitive state machine is sufficient.

Example:

```text
START
  |
  v
ACKNOWLEDGE
  |
  v
MULTI_SAY_TEST
  |
  v
INTERRUPT_TEST
  |
  v
GOODBYE
  |
  v
END
```

Scenario 2 is portal-driven rather than normal-flow-driven:

```text
START / normal current Node
        |
        | user turn
        v
INTENTION SCAN
        |
        v
isTransferToHuman
        |
        +--> attempt 0
        |      |
        |      v
        |   RE-ENGAGE
        |      |
        |      v
        |    LISTEN
        |
        `--> attempt 1
               |
               v
        TRANSFER TO HUMAN
```

Implementation may use Nodes:

```text
AcknowledgeNode
MultiSayNode
InterruptTestNode
GoodbyeNode
```

No LLM/Brain is required to choose these transitions.

This is important:

> The first PoC validates RA9 transport/orchestration mechanics, not AI intelligence.

---

# 21. PoC Logging Requirements

The PoC should be intentionally verbose.

For every inbound Vapi Custom LLM request, log:

- timestamp;
- RA9 Conversation ID;
- Vapi call/provider ID if present;
- current RA9 Node;
- current PoC state;
- normalized user input;
- sanitized provider metadata;
- sanitized message history;
- request correlation ID.

For intention/portal activity, log:

- Brain scan started;
- mock Brain profile;
- mock Brain sequence index;
- intentions returned;
- global portal matched or not matched;
- portal state before execution;
- re-engagement counter mutation;
- portal outcome;
- whether normal Node execution was skipped.

For outbound activity, log:

- `say` called;
- text;
- SSE chunk generated;
- `sayAndListen` called;
- stream completed;
- endCall requested;
- Node started/completed;
- transition selected.

For Vapi server events, log:

- event type;
- provider call ID;
- turn ID if available;
- sanitized event body.

Logs are part of the experiment and should make ordering obvious.

Example desired output:

```text
22:01:01 ConversationCreated ra9=... vapi=...
22:01:05 InputReceived node=acknowledge text="..."
22:01:05 NodeStarted acknowledge
22:01:05 SayAndListen "Nice, I can help you with that."
22:01:05 NodeCompleted acknowledge
22:01:05 Transition acknowledge -> multi-say
22:01:11 InputReceived node=multi-say text="..."
22:01:11 Say "Okay, give me a moment."
22:01:13 Say "Got it, I have some data for you."
22:01:15 SayAndListen "Here it is..."
...
22:01:30 ProviderEvent user-interrupted turnId=...
```

---

# 22. HTTP Surface for the PoC

Keep the backend surface small.

The complete RA9 use-case application is exposed locally on:

```text
http://localhost:8888
```

ngrok exposes this HTTP service publicly to Vapi.

There are exactly two Vapi-facing HTTP endpoints in the PoC.

---

## 22.1 Unified Vapi Server URL webhook endpoint

```text
POST /vapi/webhook
```

This is the **single endpoint for all Vapi Server URL messages**.

It receives messages such as:

```text
assistant-request
status-update
user-interrupted
transfer-update
end-of-call-report
...
```

RA9 must not create one controller endpoint per Vapi message type.

The common provider envelope is expected to contain:

```json
{
  "message": {
    "type": "<server-message-type>",
    "call": {
      "id": "<vapi-call-id>"
    }
  }
}
```

The first real payloads must still be logged and confirmed during the PoC.

---

## 22.2 Vapi webhook processing pipeline

Webhook processing must follow a clean DDD/application-layer pipeline:

```text
HTTP Request
    |
    v
Middleware / Guard
    |
    v
VapiWebhookController
    |
    v
VapiWebhookHandler
    |
    v
VapiMessageStrategyTriager
    |
    v
Typed Strategy
    |
    v
Command -> Response
```

### Middleware / Guard

Responsible only for transport-level invariants.

For the current PoC message set it must validate:

```text
message exists
message.type exists
message.call.id exists
```

If `message.call.id` is missing, the request must not reach application logic.

The middleware/guard may normalize and expose the Vapi Call ID for downstream use.

This requirement is intentionally strict for the PoC because all currently planned Vapi server messages are call-scoped.

If a future legitimate Vapi message type does not contain `message.call.id`, validation can later become type-aware.

---

### Controller

The controller must remain thin.

Conceptually:

```ts
@Post('/vapi/webhook')
handleWebhook(
  @Body() body: VapiServerMessageEnvelope,
): Promise<unknown> {
  return this.handler.handle(body);
}
```

The controller must not contain:

- message-type switches;
- Conversation logic;
- persistence logic;
- Vapi strategy implementations.

---

### Handler

The Handler converts the validated provider envelope into an application-level Command and invokes the strategy triager.

Conceptually:

```ts
const command = this.commandFactory.fromVapi(body);

return this.triager.execute(command);
```

The Handler owns the application boundary but not message-specific behavior.

---

### Strategy triager

The triager selects a strategy based primarily on:

```text
message.type
```

Conceptually:

```ts
interface VapiMessageStrategyTriager {
  execute(command: VapiWebhookCommand): Promise<VapiWebhookResponse>;
}
```

Possible strategy registrations:

```text
assistant-request -> AssistantRequestStrategy
status-update     -> StatusUpdateStrategy
user-interrupted  -> UserInterruptedStrategy
transfer-update   -> TransferUpdateStrategy
...
```

The triager must not implement the strategies itself.

Its job is only to resolve the correct strategy and execute it.

---

## 22.3 Generic Strategy contract

Strategies should use TypeScript generics so each strategy has a precise input/output contract.

Conceptually:

```ts
export interface Strategy<
  TCommand extends Command,
  TResponse extends Response,
> {
  execute(command: TCommand): Promise<TResponse>;
}
```

Example:

```ts
export class AssistantRequestStrategy
  implements Strategy<
    AssistantRequestCommand,
    AssistantRequestResponse
  >
{
  async execute(
    command: AssistantRequestCommand,
  ): Promise<AssistantRequestResponse> {
    // ...
  }
}
```

And:

```ts
export class StatusUpdateStrategy
  implements Strategy<
    StatusUpdateCommand,
    StatusUpdateResponse
  >
{
  async execute(
    command: StatusUpdateCommand,
  ): Promise<StatusUpdateResponse> {
    // ...
  }
}
```

This pattern is intentional.

Each strategy should have:

- one known Command type;
- one known Response type;
- one bounded responsibility;
- no knowledge of HTTP controller details.

The exact class/interface names may be refined by SpecKit.

---

## 22.4 Command layer

Provider payloads should not leak unchanged into application/domain logic.

The Handler/Command factory should convert Vapi messages into typed Commands.

Examples:

```ts
interface AssistantRequestCommand {
  vapiCallId: string;
  callMetadata: VapiCallMetadata;
}

interface StatusUpdateCommand {
  vapiCallId: string;
  status: string;
}

interface UserInterruptedCommand {
  vapiCallId: string;
  turnId?: string;
}
```

The exact types should be refined after real payloads are captured.

Raw Vapi payloads may still be attached for PoC diagnostics, but business logic should depend on normalized commands.

---

## 22.5 Response layer

Each Strategy returns an application response object.

The HTTP adapter/controller layer converts that response into the exact Vapi webhook HTTP response.

Examples:

```ts
type AssistantRequestResponse = {
  assistantId: string;
};
```

For informational events:

```ts
type EmptyWebhookResponse = {
  ok: true;
};
```

or an equivalent empty-success abstraction.

The core requirement is:

> Strategy code returns typed application responses, not raw NestJS `Response` objects.

---

## 22.6 `assistant-request` strategy

`AssistantRequestStrategy` is responsible for inbound call bootstrap.

Command:

```ts
AssistantRequestCommand
```

Expected behavior:

```text
receive vapiCallId
    |
    v
find/create durable Conversation record in PostgreSQL
    |
    v
create/register in-memory SupervisedConversation
    |
    +--> startNode
    +--> ACTIVE runtime state
    +--> provider metadata
    +--> mock Brain state
    +--> portal state
    |
    v
return configured PoC assistantId
```

It must be idempotent for retries.

It must remain fast enough for Vapi's assistant-request timeout.

It must not run LLM calls or slow enrichment.

---

## 22.7 `status-update` strategy

RA9 must react to Vapi `status-update` server messages.

The purpose of this strategy is to keep RA9 lifecycle state synchronized with the provider lifecycle.

Conceptually:

```text
Vapi says call is active/in-progress
    |
    v
RA9 may update provider lifecycle metadata

Vapi says call is ended
    |
    v
RA9 ends the Conversation in PostgreSQL
```

For the terminal status:

```text
message.type   = status-update
message.status = ended
```

the Strategy must:

1. resolve the active in-memory `SupervisedConversation` by Vapi Call ID;
2. transition the runtime Conversation to ending/ended;
3. collect/freeze the final runtime state and relevant event/history information;
4. persist the final durable Conversation state/history to PostgreSQL;
5. persist terminal timestamps/status;
6. remove the supervised Conversation from the in-memory registry;
7. return a normal informational webhook success response.

This is provider-driven cleanup.

It is different from RA9 itself deciding to end a call through `endCall`.

Both paths must converge on the same RA9 terminal Conversation semantics.

Conceptually:

```text
RA9 decides to end
    -> Vapi endCall tool
    -> provider ends
    -> status-update: ended
    -> RA9 confirms/finalizes persisted terminal state
```

and:

```text
provider/user/network ends call externally
    -> status-update: ended
    -> RA9 finalizes Conversation
```

The cleanup strategy must be idempotent because duplicate/out-of-order provider events are possible in distributed systems.

---

## 22.8 `user-interrupted` strategy

The interruption strategy is responsible for provider interruption events.

It should:

- resolve the Conversation;
- record the interruption;
- capture provider `turnId` when available;
- attach the event to current/previous RA9 turn where possible;
- avoid accidentally advancing the YAML flow;
- return informational success.

The PoC primarily uses this strategy for observation/logging.

---

## 22.9 Custom LLM endpoint

The Custom LLM endpoint is separate from the webhook endpoint:

```text
POST /vapi/chat/completions
```

This endpoint has a completely different responsibility.

It is the synchronous/streaming model interface used during conversation turns.

Its pipeline is conceptually:

```text
Vapi Custom LLM HTTP request
    |
    v
Custom LLM Controller
    |
    v
Vapi Custom LLM Adapter
    |
    v
resolve existing in-memory SupervisedConversation
    |
    v
Supervisor
    |
    v
Brain intention scan
    |
    v
global portal or current Node
    |
    v
RA9 output
    |
    v
OpenAI-compatible SSE
    |
    v
Vapi TTS / tools
```

This endpoint may keep the HTTP response open and stream multiple chunks.

The unified webhook endpoint must never be used for this streaming model interaction.

---

## 22.10 Health endpoint

```text
GET /health
```

Purpose:

- Docker health check;
- ngrok/local debugging;
- basic service readiness verification.

No general Conversation CRUD API is required for the PoC.

# 23. Ngrok and Local Development

The Roofr PoC will run locally.

Expected topology:

```text
Vapi
  |
  | public HTTPS
  v
ngrok
  |
  v
http://localhost:8888
  |
  v
Docker: roofr-poc NestJS
  |
  +--> @guidify-ai/ra9 local package
  |
  `--> Docker: PostgreSQL
```

The PoC must document:

- how to start Docker;
- how to expose the application through ngrok;
- which ngrok URL is entered in the Vapi assistant Custom LLM configuration;
- which URL is entered as the Vapi Server URL/events endpoint;
- required Vapi assistant settings;
- required server message subscriptions for interruption testing;
- required Vapi tool configuration for `endCall`;
- required voice/flush configuration for multi-say testing.

Do not automate Vapi account configuration in the first PoC unless trivial.

Manual dashboard setup is acceptable and likely preferable for exploration.

---

# 24. Roofr Vapi Account Constraint

The PoC will use an existing Roofr Vapi account to avoid unnecessary testing costs.

Important constraints:

- no credentials are committed;
- no production customer data should be intentionally used;
- use a dedicated test assistant;
- use a dedicated test number/call method where possible;
- name all created Vapi resources clearly as PoC/test resources;
- do not alter an existing production assistant;
- keep API keys/tokens in environment variables or Vapi dashboard configuration;
- the repository must contain `.env.example`, never a real `.env`.

This is an experimental integration only.

---

# 25. Docker Requirements

The Roofr PoC must be backend-only and runnable through Docker.

PostgreSQL is part of the PoC and must **not** be postponed.

At minimum:

```text
Dockerfile
docker-compose.yml
```

`docker-compose.yml` must start at least two containers:

```text
roofr-poc application
PostgreSQL
```

The application container must expose the use-case over HTTP on host port:

```text
8888
```

Expected local topology:

```text
host
 |
 +-- http://localhost:8888
 |       |
 |       v
 |   roofr-poc NestJS container
 |       |
 |       v
 |   @guidify-ai/ra9
 |
 `-- PostgreSQL container
         ^
         |
         +-- private Docker network connection from roofr-poc
```

The PostgreSQL port does not need to be publicly exposed unless useful for local development.

Application configuration should use environment variables, with safe defaults/examples in `.env.example`.

RA9 must be able to communicate with PostgreSQL through a persistence abstraction and persist Conversation data required by the PoC.

The exact ORM/query layer is not prescribed by this initiation document. SpecKit should recommend the smallest appropriate choice for NestJS/TypeScript while keeping RA9 persistence boundaries clean.

---

# 26. Suggested Future RA9 Application Skeleton

The eventual RA9 application should have recognizable structure similar to:

```text
src/
|
+-- app.module.ts
|
+-- conversation/
|   +-- context/
|   +-- nodes/
|   +-- flows/
|   +-- prompts/
|
+-- integrations/
|   +-- crm/
|   +-- appointments/
|   +-- ...
|
+-- domain/
|
+-- config/
|
+-- infrastructure/
    +-- ...
```

A possible future flow file location:

```text
src/conversation/flows/default.flow.yaml
```

The exact skeleton should be proposed during planning.

The important rule is:

> Application developers should spend most of their time inside predictable bot-specific folders, while RA9 infrastructure remains inside the installed framework package.

---

# 27. Framework Public API Goal

The framework package should eventually expose a small deliberate API, conceptually:

```ts
import {
  Ra9Module,
  Ra9Node,
  Conversation,
  ConversationContext,
  NodeContext,
  ConversationOutput,
  EventService,
  BrainService,
} from '@guidify-ai/ra9';
```

The exact names are not final.

The PoC should avoid exporting a huge accidental surface.

---

# 28. RA9 Module Integration

The desired NestJS experience is approximately:

```ts
@Module({
  imports: [
    Ra9Module.forRoot({
      // flow/config/adapters
    }),
  ],
  providers: [
    AcknowledgeNode,
    MultiSayNode,
    InterruptTestNode,
    GoodbyeNode,
  ],
})
export class AppModule {}
```

SpecKit should determine a clean minimal NestJS integration.

Do not create custom framework magic where standard NestJS modules/providers solve the problem.

---

# 29. Testing Philosophy

RA9 should eventually make bots highly testable without real phone calls.

A Node should be testable with:

- fake input;
- fake Conversation state;
- mocked integrations;
- fake Brain;
- fake output adapter;
- event assertions.

Example conceptual test:

```ts
it('emits progress and then result', async () => {
  await node.run(ctx);

  expect(output.say).toHaveBeenCalledWith(
    'Okay, give me a moment.',
  );

  expect(output.sayAndListen).toHaveBeenCalledWith(
    expect.stringContaining('Here it is'),
  );
});
```

The PoC should include basic automated tests for the deterministic state machine if implementation cost is low.

However, the core PoC validation is an actual Vapi phone call.

---

# 30. Framework Validation / Guardrails

Long-term RA9 should validate:

- exactly one start Node;
- all Nodes referenced by a flow exist;
- Nodes are registered in Nest DI;
- invalid transition targets are rejected;
- terminal Nodes terminate;
- maximum turns are enforced;
- Conversation IDs are valid;
- adapters produce valid output;
- a Node cannot complete successfully without a terminal conversational outcome.

The last invariant is important.

A Node may perform multiple intermediate `say(...)` operations, but normal successful completion must end in a terminal action such as:

```text
sayAndListen
endCall
```

---

# 31. Separation of Core and Provider Capabilities

The initial Vapi implementation will expose provider capabilities that may not exist identically on all future channels.

RA9 should therefore avoid embedding provider terminology throughout core.

Example desired separation:

```text
RA9 semantic action:
  EndConversation

Vapi adapter:
  compile to endCall tool

Future WebChat adapter:
  close/mark chat ended
```

Similarly:

```text
RA9:
  EmitOutput

Vapi:
  OpenAI-compatible SSE + flush behavior

WebChat:
  websocket/event output
```

---

# 32. What RA9 Is Not

At this stage RA9 is explicitly **not**:

- an open-source project;
- a community project;
- a no-code flow builder;
- a visual flow editor;
- a hosted SaaS;
- a Vapi replacement;
- a telephony provider;
- an LLM provider;
- a plugin marketplace;
- an MCP product;
- a billing platform;
- a generic integration marketplace;
- a frontend application;
- a replacement for NestJS DI;
- a giant prompt-management system.

These may be reconsidered later.

They are not part of this initiation.

---

# 33. What the Roofr PoC Is Not

The Roofr PoC is explicitly **not**:

- a production Roofr AI Receptionist;
- a proposal for Roofr;
- a Roofr product implementation;
- an integration with Roofr production APIs;
- an attempt to solve Roofr's current bot;
- a commercial deployment;
- a benchmark of AI quality;
- an implementation of all RA9 production architecture.

It is a private technical experiment using access to a test Vapi environment.

---

# 34. PoC Success Criteria

The PoC is successful only if an actual test call proves all critical mechanics.

Required evidence:

- [ ] An inbound test call triggers Vapi `assistant-request`.
- [ ] RA9 reads the Vapi Call Object and persists a Conversation in PostgreSQL.
- [ ] RA9 returns the configured saved PoC `assistantId` within Vapi's required timeout.
- [ ] A retry of the same `assistant-request` does not create a duplicate Conversation.
- [ ] Every user turn causes an intention scan through `BrainService`.
- [ ] Scenario 1 is driven by a deterministic ordered mock-intention sequence.
- [ ] `transferToHuman` works as a global portal independent of the current normal Node.
- [ ] First `isTransferToHuman` increments persisted re-engagement state and does not transfer.
- [ ] First human request produces the configured re-engagement phrase.
- [ ] Second `isTransferToHuman` resolves to semantic `TransferToHuman`.
- [ ] Vapi adapter emits a valid `transferCall` invocation.
- [ ] The test call actually transfers to the configured safe destination.
- [ ] Vapi calls the custom RA9 `/chat/completions` endpoint.
- [ ] The Custom LLM request is correlated to the previously persisted Conversation.
- [ ] `assistant-request` creates an in-memory `SupervisedConversation`.
- [ ] All turns for the same Vapi call resolve to the same runtime instance.
- [ ] A stable `runtimeInstanceId` or equivalent proves in-memory continuity in logs.
- [ ] Mock Brain sequence state survives between Custom LLM requests in memory.
- [ ] `transferToHuman.reengagementAttempts` survives between requests in memory.
- [ ] PostgreSQL is not used as the turn-by-turn source of truth for these active-call values.

- [ ] Incoming request is logged and understood.
- [ ] RA9 correlates repeated requests to the same call/Conversation.
- [ ] First deterministic Node response is spoken.
- [ ] State advances to the next Node.
- [ ] One Node successfully emits at least two intermediate `say` outputs.
- [ ] Delays occur between those outputs.
- [ ] The same Node eventually performs `sayAndListen`.
- [ ] The caller interrupts an intentionally long assistant response.
- [ ] RA9 receives/logs enough Vapi information to identify the interruption.
- [ ] A subsequent user turn reaches RA9 after interruption.
- [ ] RA9 advances to farewell state.
- [ ] Farewell is spoken.
- [ ] RA9 triggers Vapi's end-call mechanism.
- [ ] The telephone call actually ends.
- [ ] Vapi sends a `status-update` with terminal/ended state.
- [ ] The unified webhook routes that event to `StatusUpdateStrategy`.
- [ ] The persisted RA9 Conversation becomes terminal/ENDED.
- [ ] Repeated terminal status updates are idempotent.
- [ ] Provider-driven call termination also closes the RA9 Conversation cleanly.
- [ ] Logs show the complete ordering clearly enough to design the next iteration.

If any of these assumptions fails, the PoC should document the observed Vapi behavior rather than hacking around it invisibly.

---

# 35. Questions the PoC Must Answer

The experiment exists to answer these questions with evidence:

1. What exact `assistant-request` payload does Vapi send for the inbound call?
2. Is the canonical Vapi provider identity `message.call.id`, and is it stable across all related events?
3. What exact request shape does Vapi send to the Custom LLM endpoint?
4. Where in the Custom LLM request can RA9 obtain/correlate the Vapi call identity?
5. Which fields reliably identify the Vapi call?
6. Does the request include the whole message history every turn?
7. How should RA9 identify only the newest user input?
8. How does streaming behave when there are multi-second pauses between chunks?
9. What exact configuration is required for provider flush behavior?
10. Does each intermediate `say` become audible immediately?
11. What happens to the open Custom LLM response stream when the user interrupts?
12. Does the HTTP connection get cancelled?
13. Does RA9 receive a disconnect/abort signal?
14. Which Vapi event arrives on interruption?
15. How is the provider `turnId` correlated to model output?
16. What does the next Custom LLM request look like after interruption?
17. Does Vapi include the interrupted assistant content in the next history?
18. What portion of interrupted speech is represented in history/events?
19. What exact OpenAI-compatible tool-call stream is required to invoke `endCall` from a Custom LLM?
20. Does farewell text need to be fully spoken before `endCall` is emitted?
21. Is a separate live call control mechanism ever required?
22. What provider metadata belongs in RA9 Conversation metadata?
23. What Vapi details can remain entirely inside the adapter?

The implementation should optimize for answering these questions.

---


- What exact streamed OpenAI-compatible tool-call response does Vapi require for `transferCall` from the Custom LLM?
- Can normal streamed speech precede a `transferCall` in the same Custom LLM response?
- What Vapi events are emitted when transfer starts, completes, or fails?
- Does Vapi invoke the Custom LLM again during or after a transfer attempt?
- What is the clean RA9 lifecycle state after a successful transfer?
- How should a failed transfer be represented to the portal/Supervisor?
- Does an interrupted assistant output still cause the next Brain scan exactly once?
- What state must be committed before intermediate `say(...)` output is flushed?
- Can a global portal consume a user turn without advancing the normal flow Node exactly as designed?

# 36. Implementation Strategy for SpecKit

SpecKit should generate **two plans**, even if they are in one planning output.

## Plan A — Minimal RA9 framework foundation

Only implement framework pieces necessary to express the PoC cleanly:

- NestJS module integration;
- Conversation abstraction;
- Conversation ID/provider correlation;
- minimal Supervisor;
- mandatory per-input intention scan lifecycle;
- BrainService contract;
- deterministic/mock Brain implementation;
- global portal mechanism;
- persisted `transferToHuman` portal state;
- Node contract;
- flow loading/very small flow representation;
- output abstraction;
- event/log abstraction sufficient for PoC;
- adapter contract;
- Vapi Custom LLM adapter;
- in-memory Conversation repository if needed.

Do not implement speculative production features.

## Plan B — Roofr Vapi PoC

Implement:

- deterministic Nodes;
- deterministic flow;
- Vapi controller/endpoints;
- verbose provider logging;
- ngrok-friendly configuration;
- Docker setup;
- Vapi Custom LLM streaming;
- multiple `say` proof;
- deliberate delays;
- interruption test;
- unified Vapi webhook endpoint;
- middleware/guard for Vapi envelope + call ID;
- generic Command/Response strategy contracts;
- webhook Handler;
- message strategy triager;
- `AssistantRequestStrategy`;
- `StatusUpdateStrategy`;
- `UserInterruptedStrategy`;
- status-update Conversation cleanup;

- mock intention profiles;
- `transferToHuman` re-engagement scenario;
- real Vapi `transferCall` test;
- farewell;
- `endCall`;
- runbook explaining exact manual test procedure.

---

# 37. Future Development Roadmap

Only after the PoC proves provider mechanics should RA9 expand.

A reasonable direction is:

## Phase 1 — Transport PoC

Current specification.

Prove Vapi mechanics.

## Phase 2 — Durable Conversation runtime

Add:

- PostgreSQL durable Conversation/history storage;
- in-memory `SupervisedConversationRegistry`;
- long-lived supervised Conversation runtime;
- runtime continuity instrumentation;

- Conversation repository;
- event persistence;
- restart/resume;
- stronger state consistency;
- transaction/concurrency policy.

## Phase 3 — Real Node framework

Add:

- flow validation;
- richer transition semantics;
- Node lifecycle hooks;
- reusable output contracts;
- deterministic error handling;
- turn limits;
- timeout policies.

## Phase 4 — Brain

Add:

- provider-agnostic LLM client;
- intention classification;
- structured extraction;
- configurable models;
- token/cost observability.

## Phase 5 — Production tooling

Add:

- replay;
- conversation inspection;
- structured logs;
- metrics;
- traces;
- debugging tools;
- evaluation hooks;
- failure analytics.

## Phase 6 — Additional adapters

Potentially:

- Web Chat;
- direct HTTP;
- alternative voice provider.

Do not implement these before Vapi is understood.

---

# 38. Architectural Principles to Preserve

The following are considered foundational unless the PoC disproves them:

1. **RA9 is code-first.**
2. **NestJS DI is the dependency model.**
3. **The flow schema describes paths, not integrations.**
4. **There is exactly one start Node.**
5. **A Node is everything the bot does between user turns.**
6. **A Node may perform many actions.**
7. **A Node may emit multiple intermediate `say` outputs.**
8. **A successful Node must terminate explicitly with `sayAndListen`, `endCall`, or another future terminal action.**
9. **Provider protocols stay in adapters.**
10. **Vapi is the first adapter, not the architecture.**
11. **Conversation is long-lived logically, not necessarily as a permanently resident process.**
12. **Conversation state must eventually survive process restarts.**
13. **Events form the complete history of what happened.**
14. **External integrations are normal application code.**
15. **LLMs are injectable capabilities, not the owner of the graph.**
16. **No dead-end conversation paths are allowed.**
17. **The framework must protect against infinite loops/turns.**
18. **The application should look and feel like a conventional NestJS application with RA9 conventions.**
19. **The private framework and each customer/use-case application are separate codebases.**
20. **Do not build speculative framework features before a real use case requires them.**
21. **Every user turn passes through the intention scanner before normal Node execution.**
22. **Brain behavior must be mockable/deterministic for framework tests.**
23. **Global portals may intercept a turn without advancing the normal YAML flow.**
24. **`transferToHuman` is the first portal and must implement one persisted re-engagement attempt before transfer.**
25. **Provider-level transfer mechanics belong in the adapter, not in Nodes or portal policy.**
26. **All Vapi Server URL messages enter through one webhook endpoint.**
27. **Webhook controllers are thin; message-specific behavior lives in typed strategies.**
28. **Webhook strategies consume typed Commands and return typed Responses.**
29. **`message.call.id` is the PoC correlation invariant enforced before application logic.**
30. **Provider terminal status and RA9-requested termination converge on one Conversation terminal lifecycle.**
31. **Active calls are supervised as long-lived in-memory Conversation instances.**
32. **Repeated Custom LLM requests for one call must resolve to the same in-memory runtime instance.**
33. **PostgreSQL is the durable Conversation/history store, not the primary active-turn state machine.**
34. **`status-update: ended` freezes/persists final runtime state and removes the Conversation from memory.**
35. **Active-call crash recovery is intentionally postponed beyond the PoC.**
36. **Live voice turns must be fast. Silence on the call is a product failure.**
37. **Shit in, shit out.** Vapi stale/duplicate Custom LLM posts are a provider issue. Do not special-case them as conversation meaning. Weird people and garbage ASR are not in scope to fully handle.

---

# 39. Expected Deliverables from SpecKit

Using this initiation document, SpecKit should next produce:

1. a detailed technical design for the minimal RA9 foundation;
2. a detailed implementation plan for the Roofr Vapi PoC;
3. proposed folder structures for `guidify-ai` and the RA9 application skeleton/use-case;
4. proposed local `package.json` dependency wiring from `roofr-poc` to `@guidify-ai/ra9`;
5. proposed TypeScript contracts/interfaces;
5. proposed NestJS modules/providers;
6. proposed YAML flow schema for the PoC;
7. Vapi adapter request/response architecture;
8. SSE lifecycle design;
9. interruption handling experiment design;
10. `endCall` tool-call design;
11. Docker/ngrok runbook;
12. exact Vapi dashboard configuration checklist;
13. test plan;
14. PoC acceptance checklist;
15. explicit list of architecture questions postponed until after PoC results.

SpecKit should favor the **smallest implementation that proves the assumptions** while preserving the architectural boundaries described above.

---

# 40. Final Mental Model

The intended system should ultimately feel this simple to an application developer:

```ts
@Injectable()
export class ExampleNode extends Ra9Node {
  constructor(
    private readonly someIntegration: SomeIntegration,
  ) {
    super();
  }

  async run(ctx: NodeContext) {
    await ctx.output.say(
      'Okay, give me a moment.',
    );

    const result = await this.someIntegration.doSomething();

    await ctx.output.say(
      'Got it.',
    );

    return ctx.output.sayAndListen(
      `Here is what I found: ${result}`,
    );
  }
}
```

The application developer should not care that Vapi currently requires:

- Custom LLM HTTP requests;
- OpenAI-compatible message structures;
- SSE streaming;
- provider flush syntax;
- tool-call formatting;
- call IDs;
- server events.

RA9 + the Vapi adapter own those details.

That separation is the central architectural idea behind the framework.

# 40. FINAL MVP CLARIFICATIONS FOR CURSOR

This section supersedes any conflicting earlier wording in this document.

## 40.1 Scope: happy path only

The MVP deliberately tests only the happy-path lifetime of a call.

Do NOT implement or design:

- crash recovery;
- active-call reconstruction from PostgreSQL;
- multi-process/distributed Supervisor registries;
- failover;
- replay after application restart;
- production scaling concerns.

Expected lifecycle:

```text
assistant-request
  -> create durable Conversation record
  -> create long-lived in-memory SupervisedConversation
  -> process all Custom LLM turns against that same runtime instance
  -> receive status-update: ended
  -> persist final information/history
  -> remove runtime instance from memory
```

## 40.2 Node routing model

Do NOT model global portals by repeating transitions such as:

```yaml
isTransferToHuman: $portal.transferToHuman
```

inside every Node.

Nodes declare the intentions that point toward them. Portal Nodes are described Nodes with global scope.

Conceptual schema:

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

  interruptTest:
    class: InterruptTestNode
    intentions:
      - isInterruptTest

  goodbye:
    class: GoodbyeNode
    intentions:
      - ra9.isGoodbye
    terminal: true

  transferToHuman:
    class: TransferToHumanNode
    portal: true
    priority: 100
    intentions:
      - ra9.isTransferToHuman
```

The exact YAML keys may be refined only when necessary for a clean implementation; preserve these semantics.

## 40.3 Ranked intentions and Node `boot()` authorization

Brain returns ranked intention candidates.

Schema determines which Nodes MAY respond to those intentions.

Every Node has a `boot()` method that determines whether that Node CAN be entered at this moment.

Conceptually:

```ts
abstract class Ra9Node {
  async boot(ctx: NodeContext): Promise<boolean> {
    return true;
  }

  abstract run(ctx: NodeContext): Promise<NodeResult>;
}
```

Supervisor routing semantics:

```text
Brain -> WANT
Schema -> MAY
Node.boot() -> CAN
Node.run() -> DO
```

If the highest-ranked intention points to a Node whose `boot()` returns false, Supervisor MUST reject that candidate and try the next ranked eligible intention/Node.

Portal Nodes follow the same `boot()` contract. A portal is globally eligible, but it is not guaranteed entry.

## 40.4 Standard package intentions

Generic conversational intentions must not be redefined by every use case.

At minimum the MVP must prove consumption of standard intentions exported by `@guidify-ai/ra9`:

```text
ra9.isGoodbye
ra9.isTransferToHuman
```

Roofr-specific PoC intentions remain application-level:

```text
isAcknowledge
isMultiSayTest
isInterruptTest
```

Principle:

> Guidify AI packages own reusable conversational meaning; applications own use-case behavior.

A standard intention does not require a standard Node implementation. For example, `ra9.isGoodbye` may route to a Roofr-specific `GoodbyeNode`.

## 40.5 Mock Brain scenarios

Mock Brain must use the same intention contracts/resolution path as a future real Brain.

Scenario 1 deterministic sequence:

```yaml
sequence:
  - isAcknowledge
  - isMultiSayTest
  - isInterruptTest
  - ra9.isGoodbye
```

This proves application intentions and package intentions can coexist in one ranked intention pipeline.

Scenario 2 deterministic sequence:

```yaml
sequence:
  - ra9.isTransferToHuman
  - ra9.isTransferToHuman
```

The mock configuration belongs outside the production flow schema, for example:

```text
config/poc/state-machine.brain.yml
config/poc/transfer-human.brain.yml
```

## 40.6 Transfer portal behavior

`TransferToHumanNode` is a portal Node.

First matching request:

```text
ra9.isTransferToHuman
  -> TransferToHumanNode.boot() == true
  -> no external transfer
  -> remember re-engagement attempt IN MEMORY
  -> say: "I understand you want to speak to a human, but I can resolve it for you."
  -> listen
```

Second matching request in the same supervised Conversation:

```text
ra9.isTransferToHuman
  -> same in-memory portal state
  -> TransferToHuman
  -> Vapi adapter emits transferCall
```

`reengagementAttempts` is active-call runtime state and MUST NOT use PostgreSQL as its turn-by-turn source of truth.

## 40.7 In-memory continuity is an MVP acceptance test

`assistant-request` creates the long-lived in-memory supervised Conversation.

Every Custom LLM request for that Vapi call must resolve to the same runtime object.

Instrument this with a stable per-object `runtimeInstanceId` (or equivalent) and log it on every turn.

The following must remain in memory across requests:

- current Node/runtime position;
- mock Brain sequence index;
- portal state/re-engagement count;
- transient Conversation Memory;
- current turn/interruption state.

PostgreSQL stores durable Conversation identity, metadata, and final/history information. It is not the active state machine.

## 40.8 Unified Vapi webhook + separate Custom LLM endpoint

Use:

```text
POST /vapi/webhook
POST /vapi/chat/completions
GET  /health
```

All Vapi Server URL messages use `/vapi/webhook`.

Custom LLM streaming uses `/vapi/chat/completions` and is intentionally separate.

Webhook pipeline:

```text
Middleware/Guard
  -> Controller
  -> Handler
  -> Strategy Triager
  -> Strategy<Command, Response>
```

For the MVP, middleware/guard validates `message.call.id` before application handling.

Strategies include at least:

- AssistantRequestStrategy;
- StatusUpdateStrategy;
- UserInterruptedStrategy (as needed for Scenario 1 observation).

## 40.9 Status update terminates the RA9 runtime

When Vapi sends a terminal `status-update` (`message.status = ended`):

```text
StatusUpdateStrategy
  -> resolve in-memory SupervisedConversation by message.call.id
  -> finalize/freeze runtime state
  -> persist final durable information/history to PostgreSQL
  -> mark Conversation ENDED
  -> remove runtime object from registry
  -> return webhook success
```

This is the normal happy-path cleanup mechanism.

## 40.10 Node implementation responsibility

`schema.yml` describes graph/routing metadata, not Node behavior.

Node code owns behavior such as:

```ts
await ctx.say(...)
await ctx.sayAndListen(...)
await ctx.endCall(...)
```

A Node may emit multiple `say` operations during one execution before ending with listening, transfer, or call termination as allowed by the RA9 runtime contract.

## 40.11 Final MVP success definition

The MVP is successful when two real Vapi test calls demonstrate all of the following:

1. `assistant-request` creates PostgreSQL Conversation identity and one in-memory supervised runtime.
2. Multiple Custom LLM requests use the same runtime instance.
3. Mock Brain drives deterministic ranked intentions.
4. Both application-defined and `@guidify-ai/ra9` standard intentions route successfully.
5. Node `boot()` can reject a candidate and allow routing to continue to the next candidate.
6. Scenario 1 performs normal speech, multiple speech emissions, interruption observation, continuation, package-provided goodbye intention, and `endCall`.
7. Scenario 2 routes the standard transfer intention into a global portal Node.
8. First transfer request re-engages and keeps its counter in memory.
9. Second transfer request performs a real Vapi `transferCall`.
10. `status-update: ended` finalizes persistence and removes the runtime from memory.
11. All important transitions are visible in structured logs.

Anything beyond these requirements is outside the MVP unless required to make these happy-path tests work.

Post-PoC parking lot: [`specs/future-todos.md`](./specs/future-todos.md) (e.g. Vapi Custom Transcriber / own STT).

# 41. Cursor implementation instruction

Treat this document as an architecture/initiation specification, not permission to overbuild.

Before implementation, produce a concise implementation plan that separates:

1. `guidify-ai/packages/ra9` framework work;
2. `roofr-poc` skeleton/use-case work;
3. Vapi configuration/manual test steps;
4. the two real-call acceptance scenarios.

Then implement the smallest codebase that satisfies Section 40.11.

Prefer explicit, readable TypeScript and NestJS dependency injection over clever abstractions. Keep domain/application/provider responsibilities separated, but do not introduce infrastructure that is not exercised by this MVP.
