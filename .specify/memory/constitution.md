# Vapi Studio Constitution

Public principles for the **`@guidify-ai/vapi-studio` framework** only.
Consumer bots and commercial product roadmaps are **out of scope** here —
document those in the app repo, not in this package.

Use SpecKit (`.specify/`) + **Architecture Decision Records (ARDs)** under
`docs/ards/` when changing framework architecture. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Core Principles

### I. Framework-First Separation
The framework MUST remain free of customer / use-case conversation behavior.
Apps consume Studio only through the **public package API**. Provider wire
protocols (Vapi HTTP, SSE, tool-calls, call IDs) MUST stay inside adapters.
Application Nodes express business conversation without knowing those protocols.

**Rationale:** Reusable infrastructure; bots are separate NestJS applications.

### II. Code-First Conversation Runtime
Orchestration MUST be owned by typed NestJS code, YAML flow paths, and
Supervisor routing—not a single mega-prompt. LLMs are injectable tools for
classification, extraction, and generation. Every user turn MUST pass through
intention scanning before normal Node execution. Routing semantics:

`Brain WANT → schema MAY → Node.before() CAN → Node.listen() → Node.run() DO → Node.after()`

Nodes MUST terminate a turn explicitly (`sayAndListen`, `endCall`, transfer,
handoff / continueTo, or an equivalently defined terminal action).

**Rationale:** Deterministic code owns rules, transitions, side effects, and
safety; AI fills narrow interpretation gaps.

### III. NestJS Dependency Injection
Studio MUST use NestJS DI. Nodes, Brain, memory, persistence, and adapters are
injectable providers. Prefer explicit TypeScript over clever abstractions.

**Rationale:** Conventional NestJS DX with Studio conventions on top.

### IV. Smallest Justified Change
Ship the smallest framework change that meets a stated need (tests + docs +
ARD when architectural). Do not add speculative platform features “just in case.”

**Rationale:** Framework surface area is a permanent maintenance cost for every
consumer app.

### V. Observability Over Cleverness
Call behavior MUST be visible through structured events/logs sufficient to
answer: why this step, what was said, what memory changed. Durable persistence
and in-memory active-call state remain distinct responsibilities.

**Rationale:** Debuggability is part of the public contract.

### VI. Live Conversation Latency
An inbound call is a live conversation. Custom LLM turns MUST start Brain work
promptly on received user text. The ChatGPT live path MUST NOT debounce or hold
the HTTP response to coalesce ASR before scanning. Prefer fail-closed / re-ask
over stalling the caller when Brain times out.

**Rationale:** Silence feels like failure; channel retries desync the call.

### VII. Fail Closed on Bad Input
Do not expand the framework with special cases for every provider artifact or
ASR crumb. Unknown / re-ask on the current question is the default recovery.
Constrained fields (e.g. digit lengths) fail closed rather than inventing data.

**Rationale:** Over-handling odd input slows the bot and couples Nodes to
provider quirks.

## Framework Constraints

- This repository is the **`@guidify-ai/vapi-studio` package**, not a bot.
- Package manager: Yarn. Persistence: TypeORM. Runtime: Node in Docker for apps.
- Document required env vars and endpoints; never embed secrets in the repo.
- Host-scoped Vapi ingress: `/vapi/webhook`, `/vapi/chat/completions` (each app
  deploy has its own `PUBLIC_BASE_URL`).

## Governance

1. This constitution applies to framework contributions in this repository.
2. Architectural changes MUST add or update an **ARD** under `docs/ards/`
   (see `.specify/templates/ard-template.md`).
3. SpecKit plans/tasks for framework features MUST be checked against these
   principles before merge.
4. Prefer shipped `docs/` and `docs/reference/runtime-api.md` over historical
   SpecKit dumps.
5. Amendments bump the constitution version (MAJOR / MINOR / PATCH) with dates.

**Version**: 2.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25  
*(2.0.0 — public framework constitution; Guidify product IP removed.)*
