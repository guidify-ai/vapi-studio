# Private outbound (never committed)

Real email / webhook / inbox destinations live in **`src/private/`**, which is gitignored
(and listed in your local `.git/info/exclude`).

## Setup (maintainers)

1. Copy the example private module:

```bash
mkdir -p src/private
cp src/integrations/lead-outbound.private.example.ts src/private/lead-outbound.ts
# edit recipients, Resend wiring, webhooks
```

2. Keep secrets in `.env` only (`RESEND_API_KEY`, `HOT_LEAD_TO`, `LEAD_WEBHOOK_URL`, `DATABASE_URL`).
3. Every Resend email must use `lead-outbound-format.ts` Outcome codes:
   `SUCCESS_LEAD` | `QUOTE_REQUEST` | `TRANSFER_HUMAN` | `FAILED_LEAD`
   Subject: `[Vapi Studio] {OUTCOME} — {company}` with Outcome / Meaning / Why in the body.

3. Public clones without `src/private/` use the stub — chat still works; nothing is sent.

The tracked sample shows **how the planner conversation works**. It does not publish where Guidify stores or forwards lead data.
