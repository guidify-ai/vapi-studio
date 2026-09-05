# Implementation Plan: RA9 Framework & Roofr Vapi PoC

**Branch**: `001-ra9-vapi-poc` | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ra9-vapi-poc/spec.md`

## Summary

Build the minimal `@guidify-ai/ra9` NestJS framework package and a sibling `roofr-poc` RA9 application skeleton that proves Vapi Custom LLM mechanics for two deterministic call scenarios. Framework owns Supervisor, Node contracts, intention routing, portals, persistence abstractions, and the Vapi adapter. Application owns flow YAML, PoC nodes, mock Brain profiles, Docker Compose, and HTTP surface wiring. Active-call state stays in-memory; PostgreSQL via TypeORM stores durable identity/history. All Node runtime work happens in Docker (`node:24-bookworm-slim`).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 (Docker image `node:24-bookworm-slim`; fallback `node:22-bookworm-slim` only if required)

**Primary Dependencies**: NestJS 11, TypeORM, PostgreSQL driver (`pg`), `yaml`, `uuid`, `rxjs` (Nest peer), Yarn classic/berry as package manager for both codebases

**Storage**: PostgreSQL 16 (Docker Compose) for durable Conversation + history; in-process memory for `SupervisedConversationRegistry`

**Testing**: Jest + Nest testing utilities; unit tests for Supervisor routing/`boot()`; contract-ish tests for webhook strategy command/response mapping; no live Vapi in CI (manual acceptance)

**Target Platform**: Linux containers (Docker Compose local PoC); backend-only HTTP service

**Project Type**: Private framework package (`guidify-ai/packages/ra9`) + NestJS application skeleton (`guidify-ai/projects/roofr-poc`)

**Performance Goals**: `assistant-request` bootstrap <1.5s p95 locally excluding cold start. **Live Custom LLM turns:** first SSE speech chunk <1.5s p95 after request receipt (excluding TTS); ChatGPT scan HTTP abort at 3s; **no** pre-scan listen-hold on the ChatGPT path. Silence on a live call is a product failure. Mock Brain may still coalesce ASR crumbs with a hold.

**Constraints**: Happy-path only (no crash recovery); Docker-only Node toolchain; Yarn; TypeORM; no `packages/` layer; operator-owned Vapi/OpenAI credentials; framework must not contain Roofr-specific behavior

**Scale/Scope**: Single-process PoC; two scripted scenarios; ~1 flow, ~5 nodes, 3 webhook strategies, 1 Custom LLM endpoint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Framework-First Separation | PASS | `ra9/` vs sibling `roofr-poc/`; Vapi wire protocol in adapter |
| II. Code-First Conversation Runtime | PASS | YAML paths + Nodes + Supervisor; mock Brain for intentions |
| III. NestJS DI | PASS | Nodes/Brain/adapters as Nest providers |
| IV. Smallest Proven Slice | PASS | Section 40.11 only; no recovery/distributed registry |
| V. Observability | PASS | Structured logs + `runtimeInstanceId` |
| VI. Live Conversation Must Be Fast | PASS | ChatGPT path: no Custom LLM listen-hold; scan abort 3s; target first speech <1.5s |
| VII. Shit In, Shit Out | PASS | No Brain/Node special-case for Vapi stale repeats; unknown/re-ask is enough |
| Workspace & Runtime Constraints | PASS | `packages/ra9`, `projects/roofr-poc`, Yarn, TypeORM, Docker Node 24 |

**Post-design re-check**: PASS — contracts keep provider details in adapter; persistence split matches constitution; no speculative packages added.

## Project Structure

### Documentation (this feature)

```text
specs/001-ra9-vapi-poc/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-api.md
│   ├── ra9-public-api.md
│   └── flow-schema.md
└── tasks.md                 # created by /speckit-tasks
```

### Source Code (workspace)

```text
/Users/markpyskunov/work/guidify-ai/
├── packages/
│   └── ra9/                             # @guidify-ai/ra9
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       └── test/
├── projects/
│   └── roofr-poc/                       # RA9 Nest application skeleton
│       ├── package.json                 # "@guidify-ai/ra9": "file:../../packages/ra9"
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── config/
│       └── src/
├── specs/001-ra9-vapi-poc/
└── ra9-cursor-mvp-spec.md
```

**Structure Decision**: Single `guidify-ai` workspace with `packages/ra9` (framework) and `projects/roofr-poc` (use-case app). App consumes RA9 via Yarn `file:../../packages/ra9`.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Plan A — Minimal RA9 foundation

Implement only:

- `Ra9Module` dynamic Nest module registration
- Conversation entity + repository abstraction (TypeORM implementation provided by app or framework persistence module)
- `SupervisedConversationRegistry` (in-memory Map keyed by provider call id + RA9 conversation id)
- Supervisor turn lifecycle: Brain → schema eligibility → `boot()` → `run()`
- `Ra9Node` abstract class (`boot`/`run`)
- Flow YAML loader + intention→node index (including `portal` + `priority`)
- `BrainService` interface + `MockBrainService` (sequence profiles)
- Standard intentions: `ra9.isGoodbye`, `ra9.isTransferToHuman`
- Output port: `say`, `sayAndListen`, `endCall`, `transferToHuman` (adapter-backed)
- Event/log service sufficient for PoC structured logs
- Adapter contract + Vapi adapter (SSE OpenAI-compatible chunks, endCall tool-call, transferCall tool-call)
- Portal policy helpers for transfer re-engagement counter (stored on runtime, not Postgres turn loop)

## Plan B — Roofr Vapi PoC application

Implement:

- Nest app bootstrap wired to `Ra9Module`
- Docker Compose: `roofr-poc` + `postgres`
- Yarn local dep on `file:../../packages/ra9`
- HTTP: `POST /vapi/webhook`, `POST /vapi/chat/completions`, `GET /health`
- Guard validating `message.call.id` (webhook) / correlating call id (Custom LLM)
- Strategies: `AssistantRequestStrategy`, `StatusUpdateStrategy`, `UserInterruptedStrategy`
- Flow + nodes: Acknowledge, MultiSay, Continue, InterruptTest, Goodbye, Pause (portal), TransferToHuman (portal)
- Portal origin/return: `portalState.activePortalId` + `originNodeId` on in-memory SupervisedConversation
- Standard intentions: `ra9.isGoodbye`, `ra9.isTransferToHuman`, `ra9.isPause`
- Mock Brain YAML profiles for Scenario 1 & 2
- Deliberate delays between multi-`say` emissions
- Runbook in `quickstart.md` for operator Vapi/ngrok configuration (no secrets committed)

## Phases (implementation sequencing)

1. Scaffold both codebases + Docker/Yarn TypeScript baselines
2. Persistence + registry + Conversation bootstrap path
3. Supervisor/Brain/flow/node/output core
4. Vapi adapter + HTTP strategies + Custom LLM SSE
5. PoC nodes/scenarios + structured logging
6. Manual acceptance against Section 40.11

## Postponed until after PoC evidence

- Active-call crash recovery / rebuild from Postgres
- Distributed Supervisor registry
- Real LLM Brain provider
- CLI skeleton generator / published npm registry
- Additional channel adapters
- Full event sourcing / replay tooling
