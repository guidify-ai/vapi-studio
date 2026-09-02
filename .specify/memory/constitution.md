<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0
- Modified principles: none
- Added sections: Core Principle VII (Shit In, Shit Out)
- Removed sections: none
- Follow-up TODOs: none
-->
# Guidify AI / RA9 Constitution

## Core Principles

### I. Framework-First Separation
RA9 (`@guidify-ai/ra9`) MUST remain free of customer/use-case behavior.
Use-case applications (starting with `roofr-poc`) MUST consume RA9 only through
its public package API. Provider wire protocols (Vapi HTTP, SSE, tool-calls,
call IDs) MUST stay inside adapters. Application Nodes MUST express business
conversation behavior without knowing those protocols.

**Rationale:** The framework is reusable infrastructure; bots are installable
NestJS applications built on top of it.

### II. Code-First Conversation Runtime
Conversation orchestration MUST be owned by typed NestJS application code,
YAML flow paths, and Supervisor routing—not a single mega-prompt.
LLMs are injectable tools for classification, extraction, and generation.
Every user turn MUST pass through intention scanning before normal Node
execution. Routing semantics are Brain WANT → schema MAY → Node.before() CAN →
Node.listen() → Node.run() DO → Node.after(). Nodes MUST terminate a turn explicitly
(`sayAndListen`, `endCall`, transfer, or an equivalently defined terminal action).

**Rationale:** Deterministic code owns rules, transitions, side effects, and
safety; AI fills narrow interpretation gaps.

### III. NestJS Dependency Injection Is the Model
RA9 MUST embrace NestJS DI rather than invent a parallel container.
Nodes, Brain, memory, persistence, and adapters MUST be injectable Nest
providers/classes. Prefer explicit, readable TypeScript over clever
abstractions.

**Rationale:** Developer experience should feel like a conventional NestJS app
with opinionated RA9 conventions (Laravel-like structure, NestJS power).

### IV. Smallest Proven Slice (YAGNI)
Implement only what Section 40.11 of the initiation spec requires for the MVP.
Do NOT implement crash recovery, distributed Supervisor registries, failover,
replay-after-restart, multi-process scaling, or speculative framework features.
Happy-path active-call lifecycle only: `assistant-request` → in-memory
supervised Conversation → Custom LLM turns → `status-update: ended` cleanup.

**Rationale:** The PoC exists to prove Vapi/runtime assumptions with evidence,
not to finish a production platform.

### V. Observability Over Cleverness
PoC behavior MUST be visible through structured logs sufficient to answer the
initiation-spec experiment questions (correlation IDs, runtimeInstanceId,
intention ranks, portal state, interruption, endCall/transferCall).
Durable PostgreSQL identity/history and in-memory active-call state MUST remain
distinct responsibilities.

**Rationale:** Success is measured by observable real-call evidence, not by
hidden internal elegance.

### VI. Live Conversation Must Be Fast
An inbound call is a **live conversation**. Dead air while RA9 or the Brain
thinks is a product failure. Custom LLM turns MUST start Brain scan immediately
on the received user text. The live ChatGPT path MUST NOT debounce, sleep, or
hold the HTTP response to "catch more ASR" before scanning. Target: first
assistant speech on the SSE stream in **under 1.5s** (p95) after Custom LLM
request receipt, excluding TTS and process cold start. Brain HTTP MUST abort
by **3s** and fall back (unknown / re-ask) rather than stall the caller.

**Rationale:** Callers hang up or repeat themselves when the bot is silent;
Vapi then retries and the conversation desyncs.

### VII. Shit In, Shit Out
Stay fast so the channel is less likely to retry. Do **not** special-case
provider artifacts as conversation meaning. Duplicate / stale Custom LLM
posts (Vapi replaying the last utterance while RA9 is already working) are a
**Vapi** issue, not a Brain or Node problem. Garbage ASR, empty crumbs, and
weird callers WILL happen. RA9 MUST NOT grow scan-prompt rules or Node
recovery paths for every odd input. Unknown / re-ask on the happy-path
question is enough. A bad extract from bad input is acceptable. Not
everything has to be handled.

**Rationale:** Over-handling Vapi retries and weird people makes the bot
slower and more brittle; the PoC proves the happy path, not a perfect
interpreter of garbage.

## Workspace & Runtime Constraints

- Layout: `guidify-ai/packages/ra9` is the framework package root.
  `guidify-ai/projects/roofr-poc` is the RA9 application skeleton
  (prepared NestJS + RA9 wiring), not a generic NestJS sample.
- Package manager: Yarn.
- Persistence ORM: TypeORM.
- Runtime: Node.js LTS in Docker only (`node:24-bookworm-slim` preferred).
  Host-machine Node/Yarn installs for the application MUST NOT be required.
- Local development: Docker Compose for app + PostgreSQL; ngrok is operator-owned.
- Vapi account wiring and OpenAI keys are operator-owned; the codebase MUST
  document required endpoints and env vars without embedding secrets.

## Delivery Scope

MVP acceptance is defined by two real Vapi test scenarios proving:

1. Durable Conversation identity in PostgreSQL plus one long-lived in-memory
   supervised runtime reused across Custom LLM turns.
2. Mock Brain ranked intentions including both app intentions and standard
   package intentions (`ra9.isGoodbye`, `ra9.isTransferToHuman`, `ra9.isPause`, `ra9.isMad`, `ra9.isUnknownTransition`, `ra9.isPositive`, `ra9.isNegative`).
3. Node `before()` rejection continuing to the next eligible candidate.
4. Scenario 1 multi-`say`, interruption observation, goodbye, `endCall`.
5. Scenario 2 transfer portal re-engagement in memory, then real `transferCall`.
6. Terminal `status-update: ended` finalize/persist/remove.

Anything beyond these requirements is out of scope unless required to make the
happy path work.

## Governance

This constitution supersedes ad-hoc implementation habits for Guidify AI / RA9
work in this repository. Amendments MUST update this file with a semantic
version bump (MAJOR for incompatible principle changes, MINOR for new
principles/constraints, PATCH for clarifications), ratification/amendment
dates, and a Sync Impact Report comment.

Compliance review: SpecKit plans, tasks, and implementation MUST be checked
against these principles before merge. Complexity and new abstractions MUST be
justified against Principle IV. When the initiation document
(`ra9-cursor-mvp-spec.md`) conflicts with earlier wording, Section 40 of that
document and this constitution jointly control for the MVP.

**Version**: 1.2.0 | **Ratified**: 2026-08-11 | **Last Amended**: 2026-08-18
