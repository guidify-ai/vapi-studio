# Nodes and listens

How to structure Vapi Studio Nodes so agents and humans can keep flows maintainable.

## Start → Greeting

Happy-path shape (how `/flow` should read, and how runtime should feel):

```text
Start  →  Greeting (flow.start)  →  …
```

| Step | What it is | Runtime |
| --- | --- | --- |
| **Start** | Call / bootstrap + inject bag + near-zero prep | `ConversationEntryPoint.createVariables` / `beforeEach` — company, email, name from LP; phone from caller; optional JWT/API warm. **Must not block first speech** (target &lt; 1.5s to first SSE). Not a spoken Node; do not burn a Supervisor turn on silence. |
| **Greeting** | First real speak | `flow.start` Node — opening turn only (no Brain scan). Then the product DAG. |

**Do not** add Conversation-start or assistant-name bookends before Greeting on single-flow diagrams — Start is the entry. Squad/workflow lanes may still show per-module `__start` labels for handoff identity.

## Node = one job

Each Node should own a small slice: one ask, one verification, one side effect, or one lane step. If you need two sequential CTAs, use two Nodes (or `output.continueTo({ nodeId })`) — see [conversation-design.md](./conversation-design.md).

## `listen()` must match the ask

Whatever you just asked for, `listen()` should advertise:

- Intention names + boosts for that answer class
- `hints` for the Brain (short, operational)
- `extract` fields with **constraint-aware** `description`s when collecting data
- `resolveIntention` for cheap local matches (skip Brain when obvious) — include short answers like “new one” / “yes” / “ASAP” when the ask is constrained
- **Open-ended discovery:** prefer `INTENTION_CASCADE_PHASE.Scan` for the catch-all answer intention (so Brain can classify short/ambiguous turns). Use Match only for clear proceed phrases; keep FAQ as Force. `resolveIntention` should skip Brain for long substantive answers (≥ ~12 chars) and re-ask soft affirmatives locally — do **not** Match every ≥4-char utterance (that starves Scan)
- **Multi-choice soft affirmatives** (“yeah, why not”, bare “sure”) that do **not** name an option → re-ask which lane locally; never leave that to Brain/unknown ([conversation-design.md](./conversation-design.md#do-not-auto-pick-lanes))
- After a resolved binary fork (existing vs new, yes/no), **stamp memory** so the next menu advances; otherwise unknown recovery and re-prompts keep re-asking the same choice
- Unknown portal: Supervisor re-tries the **origin listen** on the next utterance before unknown’s own candidates — keep origin `resolveIntention` strong so restatements land on this turn
- `timeoutSeconds` when the answer type needs a non-default window

Do not leave a broad “collect name” listen active while you are asking for SMS consent.

## Extracts teach the Brain

`description` is part of the product. Spell the rule:

> North American mobile: exactly 10 digits. Prefer the first 10 digit characters; ignore trailing words. Fail if fewer than 10.

Local parsers and GOT must agree. Prefer shared helpers in the app (`collectedPhone`, `collectedPersonName`, …) called from `onExtracted`.

## Memory writes are guarded

Never write PII from raw `userText` without a validator (`looksLikePersonName`, phone normalizer, email parser). Fail closed → re-ask the same CTA.

**Never speak untrusted input:** do not `say(ctx.userText)`, Brain `reason`, or judge `reasoning` to the caller. Off-topic / injection-shaped speech → `studio.isUnknownTransition` or structured recovery — see [brain-and-prompt-injection.md](./brain-and-prompt-injection.md).

**Never speak implementation labels:** node ids, class names, intention/transition names, event types, or graph state (“we were at X”) — see [conversation-design.md](./conversation-design.md) § Human-like UX. `listen()` hints/notes are Brain-only, not TTS.

## Flow jumps

| Action | When |
| --- | --- |
| `sayAndListen` | Stay on this Node; wait for the next user turn |
| `continueTo({ nodeId })` | Same Conversation, same flow, different Node (often same turn entry speak) — **silent** unless the destination needs a new product CTA; no filler restating the last beat ([conversation-design.md](./conversation-design.md#copy-hygiene)) |
| `handoff({ to })` | Workflow module switch (Squad / multi-assistant). Same silent-handoff rule. Only when a workflow is loaded |

Keep live PoCs on one assistant + `continueTo` unless you are deliberately testing Squad.

## Portals stay portals

Transfer, pause, mad, unknown, still-there, goodbye remain high-priority portals. Happy-path Nodes must not reimplement them. Unknown recovery copy can be shared with the unknown portal so menus stay consistent.

### Mad: one re-engage, then human (hard rule)

Do **not** keep reasoning with, apologizing to, or negotiating angry callers across multiple turns. Mad people escalate; a bot that stays in de-escalation loops wastes the call and makes things worse.

| Policy | Detail |
| --- | --- |
| **First mad hit** | One short re-engage (acknowledge + invite them to continue productively), then listen |
| **Second mad hit** (still heated) | **Transfer to a human** (or after-hours block) — no third apology loop |
| **Calm continue / goodbye** | May leave the portal without transferring |
| **Do not** | Invent long empathy scripts, argue, or keep `sayAndListen` de-escalation forever |

Framework note: mad is sticky (other portals suppressed while active) so the next utterance stays on the mad listen — that is for routing control, not an excuse to chat with anger. App mad Nodes must enforce the one-re-engage → transfer policy.

### Portal re-engage must end with one CTA (hard rule)

Any portal turn that **defers** the caller’s ask (transfer re-engage, mad first apology, after-hours block) must still obey **one CTA per turn**. Do not leave them on a dead-end statement.

| Bad | Good |
| --- | --- |
| “I understand you want a human, but I can resolve it for you.” *(no ask)* | “I can often take care of this without a transfer — **how can I help you?** Or say you'd still like a person.” |
| “I'm sorry you're frustrated.” *(stops)* | “I'm sorry you're dealing with this — **tell me what's going on**, and I'll help.” |

Listen for that turn must accept: insist again (transfer/mad), calm continue, **or** a product need if you offered help.

## Flow YAML is paths (+ optional condition transitions)

`flow.yaml` lists node ids, class names, intentions, portal flags, priority, and optional **`transitions`** (pure `when` gates → `to` node, with `force` to skip Brain). Copy and extract schemas live in Node source — not in YAML, not in app README northern stars.

**Prefer code intentions** (`INTENTION_CASCADE_PHASE.Force` \| `.Match` \| `.Scan`) when a gate needs memory/history/regex freedom — register via `VapiStudioModule.forRoot({ intentions })`. YAML transitions stay useful for diagram edges; code force intentions run first in the cascade.

Use **dedicated Nodes** for identity gap-fill (consent, phone, name). Declare the same gates as `transitions` and/or force intentions when you need the graph to show *why* the bot must leave a Node — duplicating a `continueTo` is fine.

`continueTo({ text })` is spoken on the wire — do not repeat copy (especially the caller’s name) that a prior `say` in the same pass already delivered. See [conversation-design.md](./conversation-design.md#personal-treatment-names).