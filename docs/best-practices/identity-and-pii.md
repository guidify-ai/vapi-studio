# Identity and PII

Collecting caller identity without poisoning memory or stacking CTAs.

## Consent before destination

SMS / form delivery is two turns when both are needed:

1. **Consent** — “Is it okay if I text you a short form for your details?”
2. **Destination** — calling-from suitable? **or** best mobile?

Never ask consent and phone in one prompt. Decline → voice fallback path; do not re-ask consent after it is set for this Conversation.

## Phone numbers (NA default)

Unless the app explicitly supports other regions:

- Store **exactly 10 digits**.
- Strip leading country `1` when 11 digits.
- If more than 10 digit characters appear (trailing ASR), take the **first 10**.
- Fewer than 10 → fail and re-ask phone only.
- Use a **short** listen timeout while collecting digits.
- **Read-back confirm is mandatory** after spoken digits: “I heard 236-562-1379. Is that correct?” before SMS/form. Accepting calling-from ANI counts as confirm. Do not proceed on digits alone.
- Incomplete ASR (fewer than 10 digits) → say you only caught N digits and ask again — not a generic “sorry, what’s the number?”
- First ask for a missing field (e.g. mobile after consent) is a **gap fill**, not a re-ask — never preface with “I’m sorry, I didn’t quite get it.”

## Names

A person name is letters (and limited punctuation), not digits, not “hello”, not a full sentence. Reject and re-ask; never place digit strings into `firstName` / profile verify summaries (“I have 2 3 6 … on file”).

## Email

Prefer a real extract + spelled-email parser. Do not hardcode demo emails in production paths; PoC mocks belong behind clearly named constants and mock-only branches.

## Forms

- Deliver with `ctx.forms.open` (live Vapi) or `expose` (Studio-friendly blocking) + a dispose adapter that makes a fillable surface available (Studio modal, **first-party HTML** at `/forms/:exposeId`, or SMS link).
- Field specs are JSON (`FormFieldSpec`); HTML is rendered from that JSON (`renderFormHtml`), not hand-written per form.
- Submit must call `FormsService.submit(exposeId, values)` so the open path can `claimSubmitted()` (or blocking `expose` resumes).
- **Local PoC without SMS:** open `/forms/inbox` on this machine — it lists exposed / unsubmitted forms; Open → fill → Submit unblocks the waiting bot.
- **Caller never got the text / link:** while the form is still open, listen for “I didn’t get it / no text / didn’t receive the link.” Then **one CTA**: resend via `ctx.forms.resend()` and ask **“Did you get it this time?”** — do not also ask them to fill in the same turn. On yes → next turn asks them to open and fill. Cap resends (e.g. 2) then voice fallback. Never stack “resent” + “fill it out” + “still waiting” in one listen.
- Form deliver/fill failure → **one CTA**: “OK to finish by voice?” then collect fields. Never stack failure notice + first-name ask in one listen.
- After submit, voice-confirm received values when the channel is unreliable; do not treat unconfirmed ASR as identity.

## Profile verify

Only when CRM hydrated a **returning** caller (`returningCaller === true`, gated by `recognizeReturningCaller`). Never say “on file” for PII collected earlier in **this** Conversation. If recognition FF is off, treat every call as first-time for verify UX.
