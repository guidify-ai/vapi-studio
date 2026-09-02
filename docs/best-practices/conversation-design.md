# Conversation design

Hard rules for what the caller hears. Violating these produces the “bad call” class of failures (double questions, coalesced ASR, phantom profile data).

## One CTA per turn (hard rule)

Ask **one** clear call-to-action per assistant turn. Never combine unrelated decisions in one prompt.

| Bad | Good |
| --- | --- |
| “Is it okay if I text you a form? What’s the best mobile?” | Turn 1: “OK to text a short form?” → Turn 2: “Best mobile?” |
| “Do you want an appointment or an estimate, and what’s your address?” | Offer **or** collect address — not both |

**Prefer more Nodes** (or `continueTo` hops) over stuffing two CTAs into one `sayAndListen`. Combined prompts cause ambiguous answers, wrong intention routing, and extract pollution.

Answer shapes on **one** CTA can still vary (e.g. “Say yes, or give a different number”) — that is still one decision: confirm destination vs provide another.

## Fail closed on constrained fields

If a field has a hard shape (NA mobile = **exactly 10 digits**, email must parse, listed choice 1…N), the extractor must:

1. Know the constraint (local parser **and** Brain extract `description`).
2. Accept only valid recoveries (e.g. strip `+1`, take first 10 digits, drop trailing “hello”).
3. **Fail** (re-ask that same single CTA) when recovery is impossible — never invent or store junk.
4. For spoken phones: **always read back and confirm** before using the number (separate CTA).

## Listen timeouts match the answer type

Default listen windows are for natural phrases. Tighten `timeoutSeconds` on digit / short-token collection so a long pause does not coalesce a trailing “hello?” into the same turn.

- Digits / yes-no / short codes → short window (≈1s).
- Spelled email / address dictation → longer window.

## Do not auto-pick lanes

When the caller must choose between product paths (appointment vs instant estimate, existing vs new), **offer and wait**. Completing one lane may offer the companion later; never silently pick for them.

## Origin-aware recovery

On unknown / off-path speech, tell the caller what you can help with **from this node’s real options** (“I can help with A, B, or C”), not a generic “sorry, try again.”

Advertise the **same product intentions** the origin was listening for (with cheap `resolveIntention` when possible). Prefer those over `isContinue`. Continue silently resumes the origin — it must never speak “Okay, continuing.”

## Ghosting

Idle / still-there behavior is a portal concern. Keep the product happy path free of nested “are you there?” CTAs unless the portal owns that turn.

## Copy hygiene

- Prefer short questions ending in one ask.
- Confirmations should repeat **validated** values only (never raw ASR garbage).
- Do not re-ask a settled consent flag later in the same Conversation.
