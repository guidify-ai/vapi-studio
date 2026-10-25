# TODO

Planned framework work, not started. Each item needs an ARD before
implementation ([ARD process](./docs/ards/README.md)).

## Next

### Studio webhooks — dispatch call data to configured endpoints

**Goal:** Studio's own outbound webhook system, on top of what Vapi already
sends. Apps configure endpoints; Studio delivers signed events to them.

**First hook — `call.ended`, as soon as possible.** Every call collects data
into memory (name, phone, email, address, choices, form values, analytics
tags). When the call ends, Studio dispatches it to the configured endpoint(s)
right away — the receiving system should not have to poll or wait for Vapi's
end-of-call report.

**Scope to design:**

- **Pre-defined hooks** shipped by Studio: `call.ended` first; candidates
  later — `form.submitted`, `transfer.requested`, `call.started`.
- **Custom hooks** defined by the app: app-named events (e.g. `appointment.booked`)
  emitted from Nodes, delivered through the same pipeline.
- **Configuration** in `VapiStudioModule.forRoot` (endpoints, which events,
  secret per endpoint); no framework defaults for URLs or payload content
  ([ARD-0004](./docs/ards/ARD-0004-framework-decision-boundary.md)).
- **Payload:** conversation id, provider call id, end reason, timestamps, node
  path, final memory snapshot — passed through the app's redaction hook (same
  idea as `brain.memorySnapshot`) so the app decides what leaves.
- **Signature: JWT signed with HMAC (HS256)** using a per-endpoint shared secret.
  Claims: `iss`, `iat`, `exp` (short), `jti` (unique id for replay/idempotency),
  event type, and a hash of the body (or the body as the JWT payload). Sent as
  a header (e.g. `Authorization: Bearer <jwt>` or `X-Studio-Signature`). Support
  key rotation (`kid`, two active secrets).
- **Delivery:** async, never blocks the call; retries with backoff; idempotent
  by `jti`; every attempt logged as an event (`WEBHOOK_DELIVERED` /
  `WEBHOOK_FAILED`) so delivery is visible in logs and analytics.
- **Durability:** decide in-memory queue vs Redis / DB outbox, given that open
  calls and forms are in memory today.
- **Built on** the existing event bus (`EventService`, `onStudioEvent`).
- **Docs + receiver sample:** verifying the JWT in Node, plus a guide page.
