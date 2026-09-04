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

## Conversations must end (hard rule)

There is **no unlimited conversation**. The framework enforces `limits.maxTurns` (default 40) and `limits.maxDurationMs` (default 20 minutes) on every call — fail-closed goodbye + `endCall`, event `CONVERSATION_LIMIT_EXCEEDED`. Raise within hard ceilings in `VapiStudioModule.forRoot({ limits })` when a product path legitimately needs more room; never remove the caps. Design flows so a successful path finishes well under the defaults, and rely on still-there / goodbye portals for polite early exits.

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

Soft affirmatives (“yes”, “yeah, why not”, “sure”) that **do not name a lane** are not a choice — re-ask which option with a cheap `resolveIntention` (map to a ready/reprompt intention). Do not leave “why not” to Brain; scan failures send the caller into unknown recovery for no good reason.

## Origin-aware recovery

On unknown / off-path speech, tell the caller what you can help with **from this node’s real options** (“I can help with A, B, or C”), not a generic “sorry, try again.”

Advertise the **same product intentions** the origin was listening for (with cheap `resolveIntention` when possible). Prefer those over `isContinue`. Continue silently resumes the origin — it must never speak “Okay, continuing.” or name the origin node.

**Framework:** while the unknown portal is active, the next utterance is **consumed against the origin listen first** (same turn). Short answers like “ASAP” / “as soon as possible” must resolve on the origin ask — do not leave them to unknown’s Brain guess.

## Ghosting

Idle / still-there behavior is a portal concern. Keep the product happy path free of nested “are you there?” CTAs unless the portal owns that turn.

## Mad callers (hard rule)

Do **not** try to reason with mad callers more than **once**. First hit: one short re-engage. Still mad: transfer to a human (or after-hours block). No multi-turn empathy loops — see [nodes-and-listens.md](./nodes-and-listens.md#mad-one-re-engage-then-human-hard-rule).

Portal re-engages (transfer “I can help instead”, mad apology, after-hours) must still end with **one clear CTA** — never a statement with no ask ([nodes-and-listens.md](./nodes-and-listens.md#portal-re-engage-must-end-with-one-cta-hard-rule)).

## Copy hygiene

- Prefer short questions ending in one ask.
- Confirmations should repeat **validated** values only (never raw ASR garbage).
- Do not re-ask a settled consent flag later in the same Conversation.
- **Silent handoffs:** `continueTo` / `handoff` between modules must not speak filler that restates what just happened (“That is your estimate for now”, “You are all set”) before the next real CTA or farewell. Let the destination node speak once.

## Human-like UX (no implementation leakage)

**Hard rule:** Everything the caller hears must sound like a human on a business phone call — not like a developer debugging a state machine.

Forensics (node ids, transition reasons, event types, memory keys, analytics) belong in **logs, Postgres, Flow Studio, and operator UIs only**. They must **never** be spoken, paraphrased, or implied in assistant copy.

### Flow chart layout (Flow Studio / docs)

- **Main path:** left → right (conversation time flows forward).
- **Lane branches:** stack vertically with space between nodes — no overlapping edges on node labels.
- **Portal nodes:** separate row **below** the main path; dashed edges rise to the nodes they can interrupt.
- **Edges behind nodes;** intention names in corridors between boxes, not on top of them.
- **Spacing (hard minimums):** arrow corridors ≥ **2.0 × node width**; vertical gap between stacked nodes ≥ **1.5 × node height**. Intention labels must remain readable without overlapping boxes.
- **Replay (future):** highlight visited nodes on a call; dim unvisited nodes with a semi-transparent overlay.
- **Exit bookend:** the diagram `exit · endCall` (`{module}::__end`) is synthetic — not a real flow node. After a real `endCall`, Studio returns `diagramHighlightNodeId: '__end'` so Flow Studio highlights that bookend (and centers on it). Do **not** leave the last product node (e.g. farewell) as the current highlight — runtime `currentNodeId` may still be farewell for history.

Example apps (`/flow`) should follow this layout instead of a cramped vertical graph.

### Never say aloud

| Forbidden (examples) | Speak like this instead |
| --- | --- |
| “We were at `stillThere` / `routerTriage`.” | “Where were we — still working on your estimate?” (product language only) |
| “Continuing where we left off.” (after resume / portal) | Silent `isContinue` — re-ask the **same product CTA** the origin had |
| “I see you came from the identity node.” | “Let me confirm your details.” |
| “That transition didn’t match.” / “force: need_sms_phone” | “I still need your mobile number for the text.” |
| “I have analytics events showing…” / “our logs say…” | (never — operators read logs; callers don’t) |
| Intention names: `isAcceptedFormSend`, `studio.isPause` | Plain English for the one CTA |
| Class names: `IdentityCollectNode`, portal ids | Never |
| “Your `memory.formSendConsent` is undefined.” | “Can I text you a short form for your details?” |

### Product language vs graph language

| OK (caller-facing) | Internal only (never spoken) |
| --- | --- |
| “roof estimate”, “appointment”, “text you a form” | `routerTriage`, `askSmsPhone`, `isRouterReady` |
| “Are you still there?” (when the **still-there portal** owns the turn) | “stillThere portal attempt 2” |
| “Let me connect you to someone.” | `transferToHuman`, `WORKFLOW_HANDOFF` |

`listen()` **hints** and **note** fields, Brain `reason`, and `continueTo({ reason })` are for routing and forensics — **not** TTS.

### Resume and portals

- **No cross-call resume copy** in MVP (“pick up where we left off”, “we were just speaking”) unless product explicitly ships returning-caller UX — and even then, **never** cite node/module ids.
- **Continue** after a portal exits silently: restore the origin listen and re-offer its **product** menu — not “okay, continuing” or “back to node X”.

### Code review gate

Before merging agent-step copy, ask: *“Could this sentence only make sense to someone reading `flow.yaml`?”* If yes, rewrite.

See also [brain-and-prompt-injection.md](./brain-and-prompt-injection.md) (no spoken Brain/debug text) and [debugging-and-observability.md](./debugging-and-observability.md) (forensics are operator-only).

## Personal treatment (names)

Personal tone is good — using the caller’s first name can build trust. **Repeating the name in the same turn (or back-to-back turns) without a reason sounds robotic.**

### Default rule

- **At most one spoken use of the first name per assistant turn** — including across chained `say` + `continueTo` text in the same Supervisor pass.
- **Do not stack name patterns** like “Thanks, {name}. … {name}, are you …?” in one breath.

| Bad | Good |
| --- | --- |
| “Thanks, Mark. Mark, are you calling about an existing project?” | “Thanks — your details are confirmed.” → next turn: “Are you calling about an existing project, or a new one?” |
| `say("Thanks, Mark.")` + `continueTo({ text: "Thanks, Mark." })` | One thanks line **or** silent `continueTo` — not both with the name |
| Every router prompt prefixed with `{name}, ` | Name once after a milestone (confirm identity, book appointment); plain prompts after that until the next milestone |

### When repeating the name is OK

Use the name again only when there is a **clear conversational reason**, for example:

- Re-engaging after a long pause or portal interrupt (“Mark — still with me?”).
- Empathy on a sensitive turn (“I’m sorry about that, Mark.”).
- Disambiguation in a multi-party scenario (rare on phone).

If you cannot state the reason in one sentence, you probably do not need the name on that turn.

### Implementation

- Centralize copy helpers (e.g. `thanksWithFirstName`, `callerNamePrefix`) and **track whether the name was already spoken this segment** — do not sprinkle `` `${firstName}` `` in every node.
- `continueTo({ text })` is spoken too: never duplicate a line the previous `say` already delivered.
- Goodbye may use the name once; do not also use it in the sentence immediately before.

See also [identity-and-pii.md](./identity-and-pii.md) (names in verify summaries).
