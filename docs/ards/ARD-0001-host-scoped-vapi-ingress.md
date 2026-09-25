# ARD-0001: Host-scoped Vapi ingress

- **Status:** Accepted
- **Date:** 2026-09-25
- **Tags:** framework | adapter | docs

## Context

Apps need a stable way to wire Vapi Custom LLM + webhook URLs. A multi-tenant
path prefix (`/{projectUuid}/vapi/...`) is useful behind a shared reverse proxy,
but it is not the default contract of a single self-hosted Nest app.

## Decision

The framework and public starter document **host-scoped** routes only:

| Setting | URL |
| --- | --- |
| Webhook | `{PUBLIC_BASE_URL}/vapi/webhook` |
| Custom LLM | `{PUBLIC_BASE_URL}/vapi/chat/completions` |

Internal `projects.id` / UUID rows are for DB FKs and forensics — **not** required
in Vapi dashboard URLs. Optional UUID prefixes are an operator / proxy concern
outside the default starter.

## Consequences

- **Positive:** One app = one `PUBLIC_BASE_URL`; docs stay simple; matches npm README.
- **Negative:** Multi-app single-tunnel setups must add their own router (e.g. strip
  or prefix paths) without changing Studio’s app-owned controllers.
- **Follow-ups:** Keep SMS form URL helpers able to honor `PROJECT_UUID` when set,
  without making UUID paths mandatory in getting-started docs.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Always require `/{uuid}/vapi/...` | Couples every consumer to Guidify-style multi-app tunneling |
| Route by Vapi `assistantId` inside Studio | Assistant IDs are forensics, not project selection |

## References

- `docs/guide/vapi-adapter.md`
- `docs/getting-started/quick-start.md`
- `README.md` (Wire Vapi table)
