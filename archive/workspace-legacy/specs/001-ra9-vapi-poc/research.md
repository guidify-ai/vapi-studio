# Research: RA9 Framework & Roofr Vapi PoC

**Feature**: `001-ra9-vapi-poc`  
**Date**: 2026-08-11

## R1. Workspace layout without `packages/`

- **Decision**: Place framework at `guidify-ai/packages/ra9` publishing as `@guidify-ai/ra9`. Place application at `guidify-ai/projects/roofr-poc`.
- **Rationale**: User requested `packages/` + `projects/` layout inside the guidify-ai workspace.
- **Alternatives considered**: flat `guidify-ai/ra9` + sibling `/work/roofr-poc` (earlier PoC layout).

## R2. Package manager

- **Decision**: Yarn for both `ra9` and `roofr-poc`.
- **Rationale**: User mandate.
- **Alternatives considered**: npm, pnpm.

## R3. ORM

- **Decision**: TypeORM with NestJS `@nestjs/typeorm`.
- **Rationale**: User mandate; Nest-common; clean repository boundaries for Conversation/history.
- **Alternatives considered**: Drizzle (leaner SQL), Prisma (heavier generate step in Docker).

## R4. Node runtime / Docker-only toolchain

- **Decision**: `node:24-bookworm-slim` for app image and any build containers; compose runs `yarn install`/`yarn build`/`yarn start` inside containers. Host Node installs are not required for app work.
- **Rationale**: User refuses local Node installs; Node 24 is current LTS line available as Docker image (verified pull).
- **Alternatives considered**: Node 22 image fallback; host Yarn — rejected.

## R5. Framework packaging for local consume

- **Decision**: `@guidify-ai/ra9` builds to `dist/` with Nest-friendly exports; `roofr-poc` depends via `"@guidify-ai/ra9": "file:../../packages/ra9"`. Docker Compose builds with `additional_contexts` pointing at `../../packages/ra9`.
- **Rationale**: Initiation rule: application interacts only through public package API; local filesystem dependency for PoC.
- **Alternatives considered**: ts-path aliases into framework `src/` (violates package boundary); Verdaccio private registry (overkill for MVP).

## R6. Persistence split

- **Decision**: TypeORM entities for durable Conversation (+ optional ConversationEvent rows written at bootstrap/finalize and selected milestones). Active turn state exclusively on in-memory `SupervisedConversation` registered by `message.call.id`.
- **Rationale**: Section 40.7 / 40.9; proves long-lived in-memory continuity across independent Custom LLM HTTP requests.
- **Alternatives considered**: Postgres as active state machine each turn — rejected by initiation clarifications.

## R7. Vapi HTTP surface

- **Decision**:
  - `POST /vapi/webhook` — all Server URL messages
  - `POST /vapi/chat/completions` — Custom LLM SSE
  - `GET /health`
- **Rationale**: Section 40.8; keeps streaming concerns separate from webhook strategies.
- **Alternatives considered**: Single multiplexed endpoint — harder SSE lifecycle isolation.

## R8. Webhook pipeline

- **Decision**: Guard → Controller → Handler → Triager → `Strategy<Command, Response>` for `assistant-request`, `status-update`, `user-interrupted`.
- **Rationale**: Initiation §22; thin controllers; typed commands/responses.
- **Alternatives considered**: Giant switch in controller — rejected for clarity/testability.

## R9. Streaming / multi-say / interruption

- **Decision**: Vapi adapter owns OpenAI-compatible SSE chunk framing, flush behavior for intermediate `say`, and tool-call payloads for `endCall` / `transferCall`. Interrupt observation via webhook strategy + abort/disconnect handling on the open Custom LLM response when present.
- **Rationale**: Provider protocols stay in adapters; PoC must answer initiation experiment questions with logs.
- **Alternatives considered**: Nodes emitting raw SSE — violates separation.

## R10. Mock Brain

- **Decision**: YAML sequence profiles outside flow schema (`config/poc/*.brain.yml`) consumed by `MockBrainService` implementing the same `BrainService` contract.
- **Rationale**: Section 40.5; deterministic WANT path identical to future real Brain.
- **Alternatives considered**: Hard-coded switch in nodes — bypasses intention pipeline and would not prove package intention coexistence.

## R11. Routing model

- **Decision**: Nodes declare intentions; portals use `portal: true` + `priority`; Supervisor ranks Brain candidates, filters by schema eligibility, then `boot()`.
- **Rationale**: Section 40.2–40.3 supersedes repeating portal transitions in every node.
- **Alternatives considered**: Per-node `isTransferToHuman: $portal...` transitions — explicitly forbidden for MVP.

## R12. SpecKit tooling vs Docker-only Node

- **Decision**: SpecKit CLI (`specify`) may live as an agent tool install under the workspace `.uv-bin`/`.uv-tools` (Python/uv). Application Node/Yarn tooling stays containerized.
- **Rationale**: SpecKit is required process tooling for Cursor; user’s Docker-only rule targets the Node application runtime.
- **Alternatives considered**: Running SpecKit inside Docker — unnecessary friction for agent workflow.
