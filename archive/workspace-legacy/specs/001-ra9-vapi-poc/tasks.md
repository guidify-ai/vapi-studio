# Tasks: RA9 Framework & Roofr Vapi PoC

**Input**: Design documents from `/specs/001-ra9-vapi-poc/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested for TDD gate; optional focused unit checks may be added during foundation if cheap. Manual Vapi acceptance is the primary proof.

**Organization**: Setup → Foundation → US1 (bootstrap) → US2 (scenario 1 nodes) → US3 (transfer portal) → US4 (boundary polish) → Polish

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1…US4 map to spec user stories
- Paths are absolute under `/Users/markpyskunov/work/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold both codebases and Docker/Yarn baselines (Node only in Docker)

- [x] T001 Create framework package skeleton dirs under `/Users/markpyskunov/work/guidify-ai/ra9/` (`src/`, `test/`, `tsconfig.json`, `package.json` name `@guidify-ai/ra9`)
- [x] T002 Create sibling app skeleton `/Users/markpyskunov/work/roofr-poc/` with NestJS app layout (`src/`, `config/`, `test/`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `package.json`)
- [x] T003 [P] Add Yarn manifests + scripts for build/start/test in `/Users/markpyskunov/work/guidify-ai/ra9/package.json` and wire Nest/TypeScript deps for a library build to `dist/`
- [x] T004 [P] Add Yarn manifests in `/Users/markpyskunov/work/roofr-poc/package.json` with `"@guidify-ai/ra9": "file:../guidify-ai/ra9"` and NestJS app dependencies (TypeORM, pg, yaml, uuid)
- [x] T005 Author `/Users/markpyskunov/work/roofr-poc/Dockerfile` using `node:24-bookworm-slim`, Yarn install/build inside image, and compose service wiring for app + Postgres 16 in `/Users/markpyskunov/work/roofr-poc/docker-compose.yml`
- [x] T006 [P] Add root ignore rules for SpecKit tooling/secrets in `/Users/markpyskunov/work/guidify-ai/.gitignore` and `/Users/markpyskunov/work/roofr-poc/.gitignore` (`.env`, `node_modules`, `dist`, `.uv-bin`, `.uv-tools`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: RA9 core runtime + app HTTP shell required by every story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Implement TypeORM `Conversation` (+ optional `ConversationEvent`) entities and repository abstraction in `/Users/markpyskunov/work/guidify-ai/ra9/src/persistence/`
- [x] T008 [P] Implement `SupervisedConversation` + `SupervisedConversationRegistry` in `/Users/markpyskunov/work/guidify-ai/ra9/src/conversation/`
- [x] T009 [P] Implement structured `EventService`/logger facade in `/Users/markpyskunov/work/guidify-ai/ra9/src/events/`
- [x] T010 [P] Implement `Ra9Node`, `NodeContext`, and output port interfaces (`say`, `sayAndListen`, `endCall`, `transferToHuman`) in `/Users/markpyskunov/work/guidify-ai/ra9/src/node/` and `/Users/markpyskunov/work/guidify-ai/ra9/src/output/`
- [x] T011 Implement flow YAML loader + intention/portal index in `/Users/markpyskunov/work/guidify-ai/ra9/src/flow/`
- [x] T012 [P] Implement `BrainService` contract, standard intentions (`ra9.isGoodbye`, `ra9.isTransferToHuman`), and `MockBrainService` sequence runner in `/Users/markpyskunov/work/guidify-ai/ra9/src/brain/` and `/Users/markpyskunov/work/guidify-ai/ra9/src/intentions/`
- [x] T013 Implement Supervisor turn lifecycle (WANT → MAY → CAN/`boot()` → DO/`run()`) in `/Users/markpyskunov/work/guidify-ai/ra9/src/supervisor/`
- [x] T014 Implement adapter contracts + Vapi SSE/tool-call compiler stubs in `/Users/markpyskunov/work/guidify-ai/ra9/src/adapters/`
- [x] T015 Implement `Ra9Module` and public exports in `/Users/markpyskunov/work/guidify-ai/ra9/src/ra9.module.ts` and `/Users/markpyskunov/work/guidify-ai/ra9/src/index.ts`
- [x] T016 Wire Nest `AppModule`, config, TypeORM connection, and `Ra9Module` in `/Users/markpyskunov/work/roofr-poc/src/app.module.ts` and `/Users/markpyskunov/work/roofr-poc/src/main.ts`
- [x] T017 [P] Implement `GET /health` in `/Users/markpyskunov/work/roofr-poc/src/health/`
- [x] T018 Implement Vapi guard/controller/handler/triager shell for `POST /vapi/webhook` and `POST /vapi/chat/completions` in `/Users/markpyskunov/work/roofr-poc/src/vapi/`
- [x] T019 Add flow + brain config placeholders in `/Users/markpyskunov/work/roofr-poc/config/flow.yaml` and `/Users/markpyskunov/work/roofr-poc/config/poc/*.brain.yml`
- [x] T020 Verify Docker build/up + health via compose from `/Users/markpyskunov/work/roofr-poc/` (all Yarn/Node commands inside containers)

**Checkpoint**: Foundation ready — health up, packages link, module boots

---

## Phase 3: User Story 1 - Start supervised voice conversation (Priority: P1) 🎯 MVP

**Goal**: `assistant-request` creates durable Conversation + supervised runtime; Custom LLM turns reuse same `runtimeInstanceId`; ended status finalizes and removes runtime

**Independent Test**: Simulate/bootstrap webhook + completions correlation locally; confirm registry continuity and ended cleanup in logs/DB

### Implementation for User Story 1

- [x] T021 [US1] Implement `AssistantRequestStrategy` creating Conversation + registry entry and assistant response pointing at Custom LLM URL in `/Users/markpyskunov/work/roofr-poc/src/vapi/strategies/assistant-request.strategy.ts`
- [x] T022 [US1] Implement call-id correlation + registry resolve on Custom LLM requests in `/Users/markpyskunov/work/roofr-poc/src/vapi/` and Vapi adapter request parsing in `/Users/markpyskunov/work/guidify-ai/ra9/src/adapters/vapi/`
- [x] T023 [US1] Implement `StatusUpdateStrategy` ended path (finalize, persist, registry delete) in `/Users/markpyskunov/work/roofr-poc/src/vapi/strategies/status-update.strategy.ts`
- [x] T024 [US1] Log `runtimeInstanceId`, providerCallId, conversationId on bootstrap and every turn in `/Users/markpyskunov/work/guidify-ai/ra9/src/events/` usage sites
- [x] T025 [US1] Reject webhook messages missing `message.call.id` in `/Users/markpyskunov/work/roofr-poc/src/vapi/vapi.guard.ts`

**Checkpoint**: US1 bootstrap/continuity/ended cleanup works without full scenario nodes

---

## Phase 4: User Story 2 - Deterministic multi-step conversation (Priority: P1)

**Goal**: Scenario 1 mock Brain drives acknowledge → multi-say → interrupt → package goodbye/`endCall`

**Independent Test**: `POC_BRAIN_PROFILE=state-machine` real (or scripted) call; logs show multi-say, interrupt observation, `ra9.isGoodbye`, endCall

### Implementation for User Story 2

- [x] T026 [P] [US2] Implement `AcknowledgeNode` in `/Users/markpyskunov/work/roofr-poc/src/conversation/nodes/acknowledge.node.ts`
- [x] T027 [P] [US2] Implement `MultiSayNode` with deliberate delays between multiple `say` calls in `/Users/markpyskunov/work/roofr-poc/src/conversation/nodes/multi-say.node.ts`
- [x] T028 [P] [US2] Implement `InterruptTestNode` in `/Users/markpyskunov/work/roofr-poc/src/conversation/nodes/interrupt-test.node.ts`
- [x] T029 [P] [US2] Implement `GoodbyeNode` using `ra9.isGoodbye` + `endCall` in `/Users/markpyskunov/work/roofr-poc/src/conversation/nodes/goodbye.node.ts`
- [x] T030 [US2] Finalize `config/flow.yaml` node/intention wiring and register node providers in `/Users/markpyskunov/work/roofr-poc/src/`
- [x] T031 [US2] Load `config/poc/state-machine.brain.yml` via MockBrain profile selection (`POC_BRAIN_PROFILE`) in app config
- [x] T032 [US2] Complete Vapi adapter SSE streaming for intermediate `say`, `sayAndListen`, and `endCall` tool-call compilation in `/Users/markpyskunov/work/guidify-ai/ra9/src/adapters/vapi/`
- [x] T033 [US2] Implement `UserInterruptedStrategy` + Custom LLM abort handling for interruption observation in `/Users/markpyskunov/work/roofr-poc/src/vapi/strategies/user-interrupted.strategy.ts` and adapter stream lifecycle
- [x] T034 [US2] Ensure Supervisor demonstrates a `boot()` reject→next-candidate path (can be a temporary test hook or intentional node boot rule) with structured logs

**Checkpoint**: Scenario 1 happy path demonstrable

---

## Phase 5: User Story 3 - Transfer-to-human portal (Priority: P1)

**Goal**: Global portal re-engages once in memory, then performs real `transferCall`

**Independent Test**: `POC_BRAIN_PROFILE=transfer-human` call; first transfer intention re-engages; second transfers

### Implementation for User Story 3

- [x] T035 [US3] Implement `TransferToHumanNode` portal with in-memory `reengagementAttempts` on supervised runtime in `/Users/markpyskunov/work/roofr-poc/src/conversation/nodes/transfer-to-human.node.ts`
- [x] T036 [US3] Ensure flow marks transfer node `portal: true` + priority and framework routing honors portals in `/Users/markpyskunov/work/roofr-poc/config/flow.yaml` + `/Users/markpyskunov/work/guidify-ai/ra9/src/supervisor/`
- [x] T037 [US3] Implement Vapi adapter `transferCall` tool-call streaming in `/Users/markpyskunov/work/guidify-ai/ra9/src/adapters/vapi/`
- [x] T038 [US3] Add `config/poc/transfer-human.brain.yml` and env-driven profile switch documentation in `/Users/markpyskunov/work/roofr-poc/.env.example`
- [x] T039 [US3] Confirm portal counter is not Postgres turn source of truth (code + log assertions) across `/Users/markpyskunov/work/guidify-ai/ra9/src/conversation/` and persistence layer

**Checkpoint**: Scenario 2 happy path demonstrable

---

## Phase 6: User Story 4 - Framework/application separation (Priority: P2)

**Goal**: Clear public API boundary; no Roofr specifics in framework

**Independent Test**: Inspect exports and directories; app imports only `@guidify-ai/ra9` public API

### Implementation for User Story 4

- [x] T040 [P] [US4] Finalize public export surface in `/Users/markpyskunov/work/guidify-ai/ra9/src/index.ts` per `contracts/ra9-public-api.md`
- [x] T041 [P] [US4] Audit `guidify-ai/ra9` for Roofr-specific copy/nodes and remove any leakage
- [x] T042 [US4] Ensure `roofr-poc` has no deep imports into framework internals (grep + fix)

**Checkpoint**: Package boundary review passes

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T043 [P] Align `/Users/markpyskunov/work/guidify-ai/specs/001-ra9-vapi-poc/quickstart.md` with final compose service names/env vars
- [x] T044 [P] Add concise operator checklist for Vapi dashboard fields in `/Users/markpyskunov/work/roofr-poc/README.md`
- [x] T045 Run compose health + dry webhook smoke (synthetic payloads) from `/Users/markpyskunov/work/roofr-poc/`
- [x] T046 Capture/confirm Section 40.11 acceptance checklist mapping in `/Users/markpyskunov/work/guidify-ai/specs/001-ra9-vapi-poc/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: start immediately
- **Foundational (Phase 2)**: depends on Setup — blocks all stories
- **US1 → US2 → US3**: sequential recommended (US2/US3 need US1 correlation + streaming shell)
- **US4**: after US2/US3 behavior exists (or parallel late)
- **Polish**: after desired stories complete

### User Story Dependencies

- **US1**: after Foundation
- **US2**: after US1 (needs Custom LLM turn pipeline)
- **US3**: after US1 + Supervisor/portal foundation (can parallelize with US2 node work after T032 exists)
- **US4**: after exports stabilize

### Parallel Opportunities

- T003/T004/T006 in Setup
- T008/T009/T010/T012 in Foundation
- T026–T029 node classes in US2
- T040/T041 in US4
- T043/T044 in Polish

---

## Parallel Example: User Story 2 Nodes

```bash
Task: "Implement AcknowledgeNode in roofr-poc/src/conversation/nodes/acknowledge.node.ts"
Task: "Implement MultiSayNode in roofr-poc/src/conversation/nodes/multi-say.node.ts"
Task: "Implement InterruptTestNode in roofr-poc/src/conversation/nodes/interrupt-test.node.ts"
Task: "Implement GoodbyeNode in roofr-poc/src/conversation/nodes/goodbye.node.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup
2. Phase 2 Foundation
3. Phase 3 US1 bootstrap/continuity
4. Validate registry + ended cleanup
5. Continue US2/US3 for full Section 40.11

### Incremental Delivery

1. Health + Docker linking
2. Bootstrap/ended lifecycle
3. Scenario 1 speech/interrupt/endCall
4. Scenario 2 transfer portal
5. Boundary polish + runbook

### Notes

- All Node/Yarn commands execute in Docker
- Operator owns live Vapi/ngrok/keys
- Do not implement crash recovery or distributed registry
