# Feature Specification: RA9 Framework & Roofr Vapi PoC

**Feature Branch**: `001-ra9-vapi-poc`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "Implement the RA9 private conversational-bot framework and a Roofr Vapi Custom LLM PoC per `ra9-cursor-mvp-spec.md`, using SpecKit lean path. Framework lives at `guidify-ai/ra9`; `roofr-poc` is a sibling prepared RA9 NestJS application skeleton consuming the framework via local package dependency. Operator owns Vapi wiring and AI keys. Application Node runtime is Docker-only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a supervised voice conversation (Priority: P1)

An inbound voice call arrives on the configured voice channel. The system creates a durable conversation identity, starts one long-lived supervised conversation runtime for that call, and answers with an assistant configuration that points subsequent model turns at the RA9 Custom LLM endpoint.

**Why this priority**: Without conversation bootstrap and stable call correlation, no later PoC scenario can run.

**Independent Test**: Place one inbound test call and verify a durable conversation record exists, a supervised runtime is created, and later turns reuse that same runtime identity.

**Acceptance Scenarios**:

1. **Given** the PoC service is reachable by the voice provider, **When** an inbound call triggers assistant bootstrap, **Then** a durable conversation identity is created and correlated to the provider call id.
2. **Given** bootstrap succeeded, **When** subsequent Custom LLM turns arrive for the same call, **Then** they resolve to the same supervised runtime instance.
3. **Given** the call ends with a terminal provider status update, **When** the ended status is received, **Then** final conversation information is persisted and the supervised runtime is removed from memory.

---

### User Story 2 - Deterministic multi-step conversation with multi-speech and goodbye (Priority: P1)

A caller walks a deterministic mock-intention sequence: acknowledge → multi-speech test → interrupt observation → package goodbye. The bot speaks intermediate phrases during a single turn where required, observes interruption behavior, then ends the call politely.

**Why this priority**: This is the primary transport/runtime proof for multi-say, interruption observation, package intentions, and end-call.

**Independent Test**: Run Scenario 1 mock Brain profile through a real voice call (or equivalent scripted provider traffic) and confirm each step from structured logs and audible behavior.

**Acceptance Scenarios**:

1. **Given** Scenario 1 mock Brain is active, **When** the first user turn arrives, **Then** the acknowledge node runs and the bot listens for the next turn.
2. **Given** the next ranked intention is multi-speech test, **When** that node runs, **Then** the caller hears multiple distinct speech emissions in one turn before listening resumes.
3. **Given** the interrupt-test step is active, **When** the caller interrupts assistant speech, **Then** the system records interruption-related provider signals and continues the conversation path without losing the supervised runtime.
4. **Given** the goodbye package intention is selected, **When** the goodbye node runs, **Then** the bot delivers farewell behavior and requests call termination through the channel adapter.

---

### User Story 3 - Transfer-to-human portal with one re-engagement (Priority: P1)

A caller asks for a human twice. The first request is handled by a global transfer portal that re-engages without transferring. The second request in the same supervised conversation performs a real provider transfer.

**Why this priority**: Proves global portal routing, in-memory portal state, and adapter-owned transfer mechanics.

**Independent Test**: Run Scenario 2 mock Brain profile and confirm first request re-engages, second request transfers, and portal counters remain in-memory only during the active call.

**Acceptance Scenarios**:

1. **Given** Scenario 2 mock Brain returns transfer intention, **When** the portal node boots successfully on first match, **Then** the bot re-engages verbally and does not transfer.
2. **Given** the same supervised conversation already recorded one re-engagement, **When** transfer intention matches again, **Then** the adapter performs a real provider transfer.
3. **Given** portal re-engagement state exists only in the active runtime, **When** the call ends, **Then** that counter is not treated as the durable turn-by-turn source of truth in the durable store.

---

### User Story 4 - Framework/application separation for future bots (Priority: P2)

An engineer can treat `roofr-poc` as a prepared RA9 application skeleton and `@guidify-ai/ra9` as the reusable framework package. Roofr-specific nodes, flow, and mock Brain profiles live only in the application.

**Why this priority**: Validates the product philosophy even if Scenario 1/2 already pass.

**Independent Test**: Inspect package boundaries and confirm the application depends on the public framework API only; framework contains no Roofr-specific nodes or copy.

**Acceptance Scenarios**:

1. **Given** the workspace layout, **When** an engineer opens the framework package, **Then** they find runtime contracts, Supervisor, adapters, standard intentions, and persistence abstractions only.
2. **Given** the application skeleton, **When** an engineer opens use-case folders, **Then** they find flow definition, PoC nodes, mock Brain profiles, and app configuration only.
3. **Given** standard package intentions such as goodbye and transfer-to-human, **When** the application routes them, **Then** application-owned nodes implement behavior while package-owned intention names remain reusable.

---

### Edge Cases

- Provider webhook arrives without a usable call identity → request is rejected before application handling.
- Highest-ranked intention maps to a node whose `boot()` returns false → Supervisor tries the next ranked eligible intention/node.
- Custom LLM turn arrives after the supervised runtime was removed → system fails safely without recreating an active-call runtime from durable history (crash recovery is out of scope).
- Unsupported provider webhook message types → handled without crashing the process; logged for observation.
- Interrupted assistant speech → conversation continues; interruption does not erase durable conversation identity.
- Live turn is slow (Brain hold, hung OpenAI, fat prompt) → caller hears dead air and Vapi may retry. Stay fast (FR-021). Do **not** special-case those retries as conversation meaning (FR-022).
- Vapi stale/duplicate Custom LLM posts, garbage ASR, or a weird caller → unknown / re-ask is enough. Shit in, shit out. Not every odd input is in scope to handle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a durable conversation identity when a voice call is bootstrapped.
- **FR-002**: System MUST create exactly one supervised in-memory conversation runtime per active provider call and reuse it for all Custom LLM turns of that call.
- **FR-003**: System MUST correlate provider traffic using the provider call identity as the PoC correlation invariant.
- **FR-004**: System MUST expose one unified voice-provider webhook entrypoint for server messages and a separate Custom LLM streaming entrypoint.
- **FR-005**: System MUST route webhook messages through thin intake into typed strategy handlers for at least assistant bootstrap, status update, and user-interrupted observation.
- **FR-006**: System MUST scan every user turn for ranked intentions before normal node execution.
- **FR-007**: System MUST support deterministic/mock Brain profiles that exercise the same intention contracts as a future real Brain.
- **FR-008**: System MUST support both application-defined intentions and reusable package-standard intentions (`goodbye`, `transfer-to-human` at minimum).
- **FR-009**: System MUST determine node eligibility from flow schema metadata and authorize entry with each candidate node's `boot()` check.
- **FR-010**: System MUST allow a node to emit multiple intermediate speech outputs in one turn before a terminal listen/end/transfer action.
- **FR-011**: System MUST support a global portal node for transfer-to-human with one in-memory re-engagement attempt before real transfer.
- **FR-012**: Channel adapters MUST own provider-specific speech streaming, end-call, and transfer mechanics.
- **FR-013**: On terminal ended status, system MUST finalize/persist durable conversation information and remove the supervised runtime from memory.
- **FR-014**: System MUST emit structured logs covering bootstrap, runtime instance identity, intention ranks, node entry/rejection, speech/terminal actions, interruption signals, transfer/end-call, and ended cleanup.
- **FR-015**: Framework package MUST NOT contain Roofr-specific conversation behavior; the Roofr PoC application MUST contain use-case nodes, flow, and mock profiles.
- **FR-016**: Application MUST consume the framework as an installable local package dependency through its public API only.
- **FR-017**: Durable store MUST hold conversation identity/metadata/final history; active-call runtime state (current node position, mock Brain index, portal counter, transient memory, interruption state) MUST live in the supervised runtime.
- **FR-018**: MVP MUST NOT implement crash recovery, reconstruction of active calls from durable history, distributed supervisor registries, failover, or multi-process scaling.
- **FR-019**: Operators MUST be able to run the PoC service and its durable store via containerized local development without requiring a host Node.js toolchain install.
- **FR-020**: System MUST provide health check and documented environment variables so operators can connect their own voice-provider account and AI credentials.
- **FR-021**: Live Custom LLM turns MUST be fast: no pre-scan listen-hold on the ChatGPT path except an uninterruptible listen (`interruptible: false`), which queues overlapping POSTs until ~3s of silence after the last fragment; Brain HTTP abort ≤ 3s; target first SSE speech chunk < 1.5s p95 after request receipt (excluding TTS and cold start). Speech MUST be written on the Custom LLM HTTP request Vapi still has open (queued waiters run or replay last assistant speech — never complete the latest stream with empty content). Silence on a live call is a product failure.
- **FR-022**: System MUST NOT special-case Vapi stale/duplicate Custom LLM posts (replayed last utterance while a turn is in flight) as conversation meaning. Brain prompts and Nodes MUST NOT grow recovery rules for every garbage ASR crumb or weird caller. Unknown / re-ask is sufficient; a bad extract from bad input is acceptable.

### Key Entities

- **Conversation**: Durable identity for one provider call, with status and correlation metadata.
- **Supervised Conversation Runtime**: In-memory active-call process state reused across turns.
- **Flow**: Path/routing metadata declaring start node, nodes, intentions, portal/priority flags.
- **Node**: Application unit of turn behavior with `boot` authorization and `run` execution.
- **Intention**: Ranked conversational meaning produced by Brain; may be package-standard or app-specific.
- **Portal**: Globally eligible node that may intercept a turn without advancing normal flow the same way ordinary nodes do.
- **Event/History Record**: Observable record of what happened, sufficient for PoC audit and experiment answers.
- **Channel Adapter Output**: Provider-agnostic speech/listen/end/transfer actions compiled to provider protocol.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two real voice test calls (Scenario 1 and Scenario 2) each complete their scripted happy path end-to-end in a single sitting.
- **SC-002**: For every Custom LLM turn of an active call, logs show the same supervised runtime instance identity created at bootstrap.
- **SC-003**: Scenario 1 demonstrates at least two distinct intermediate speech emissions in one turn, interruption observation, package goodbye intention routing, and call termination.
- **SC-004**: Scenario 2 demonstrates first transfer request re-engagement with no transfer, and second request performing a real provider transfer.
- **SC-005**: After ended status, durable conversation record remains queryable and the supervised runtime is no longer present in memory.
- **SC-006**: At least one `boot()` rejection path is demonstrable in logs while routing still continues to a later eligible candidate.
- **SC-007**: An engineer can identify framework vs application boundaries by folder/package layout in under 10 minutes without reading provider protocol docs.
- **SC-008**: A new operator can start the containerized PoC stack and confirm health without installing Node on the host.
- **SC-009**: On a live ChatGPT call, logs show Brain `durationMs` per scan; the caller is not left in multi-second silence before the next question (no Custom LLM listen-hold; OpenAI abort ≤ 3s).

## Assumptions

- Operator will connect Roofr's Vapi account, ngrok/tunneling, phone number, and transfer destination themselves.
- Operator will supply any required AI provider key when/if a non-mock Brain is introduced; MVP uses deterministic mock Brain profiles.
- Section 40 of `ra9-cursor-mvp-spec.md` supersedes earlier conflicting wording for MVP scope.
- Happy-path only: unsupported provider events are logged/ignored safely rather than fully productized.
- `roofr-poc` is the first RA9 application skeleton exemplar and may later inform a reusable starter template.
- Workspace layout uses `guidify-ai/ra9` (no intermediate `packages/` directory) and sibling `roofr-poc`.
- Package manager is Yarn; durable persistence uses a relational store accessed through TypeORM (planning detail; not a user-facing requirement).
- Node runtime is LTS via Docker image `node:24` (fallback `node:22` only if 24 is unavailable).
