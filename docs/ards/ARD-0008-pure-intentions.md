# ARD-0008: Pure intentions — the scan decides where to go, nodes extract data

- **Status:** Proposed
- **Date:** 2026-10-25
- **Tags:** runtime | brain | intentions | nodes

## Context

A real turn from a project built on Studio, at a phone step:

```text
BOT     "Is the phone you are calling from suitable to receive a text?
         Say yes if that works, or give me a different mobile number."
LISTEN  intentions: isCollectedPhone, isConfirmedPhone, studio.isPositive, …
        extract:    [phone]
CALLER  "No."  … while the bot was working: "Yes."  →  queued as "No. Yes."
BRAIN   scan → scan_error after 3008 ms → studio.isUnknownTransition
EXTRACT undefined
```

One scan request did two jobs: decide **where to go** (confirmed, gave another
number, declined) and pull out **a value** (the number). When it timed out, both
were lost.

How Studio got here:

- Since 0.0.1, Node 1 can declare fields it wants from the next answer
  (`sayAndListen(..., { extract })`); the scan extracts them and Node 1's
  `onExtracted` writes memory before routing. Node 1 describes data that Node 2
  consumes.
- ARD-0006 added decision models, which only score. To keep `extract` working it
  added `brain.delegate`, a chat model called in parallel with every scan that
  has fields — a second provider call to preserve a coupling.
- In practice most `onExtracted` callbacks already parse `userText` themselves
  and treat the model's value as a first guess; some ignore it entirely.
- A node's `catch()` handles errors from `run()` only. An error thrown from
  `before()` skips `catch()` and breaks the call.
- Nodes often end with several `sayAndListen` exits, each with its own listen
  set. When sets overlap, finding out why the call reached the next node takes
  an analytics investigation.

## Decision

1. **An intention answers one question: where does the call go next.** It never
   carries data. It may come from the caller's words (Brain scan, listen
   `resolveIntention`, match-phase `CodeIntention`, `studio.*`) or be an `if`
   gate on call state (force-phase `CodeIntention`, flow conditions). One
   intention per outcome of the call to action — "gave a number", not "gave a
   good number" / "gave a bad number". The scan cannot verify data, so it does
   not judge it.
2. **The receiving node extracts.** Node 2 reads `ctx.userText` (and history,
   memory) wherever it likes — `before()`, `run()`, a helper — with whatever
   works: code, regex, direct use, or a chat model through `ctx.clarify`. It
   triages the value (good, incomplete, wrong, too much) and asks follow-ups.
   Studio adds no extraction feature of its own; freedom of development is the
   framework's job.
3. **A node's expectations are its signature.** Data that breaks them is an
   error thrown by Node 2, as with a breached method signature. `catch()` now
   handles errors from `before()` as well as `run()`, and decides: route back
   with `forceIntention(...)` so Node 1 asks again, rephrased for the failure;
   answer directly with `catchResult(...)`; `restartNode()`; or rethrow and break
   the call (the default — the node needs fixing). `before()` returning `false`
   still means "not my turn" and the walk moves on.
4. **Scan-time extraction is removed** in 0.2.0: `sayAndListen({ extract })`,
   `ListenExpectation.extract`, `BrainScanResult.extracted`, the `extract` part
   of LLM scan prompts and the parallel extraction call in decision drivers.
   Every Brain scan returns ranked intentions only.
5. **`brain.delegate` becomes `brain.llm`**: the chat model that serves nodes'
   `ctx.clarify` and `ctx.judge`. Required with a decision-model scanner (which
   cannot write); optional with a chat-model scanner, which answers them itself
   when `brain.llm` is unset. Supersedes ARD-0006 decision 6.
6. **One call to action per node — best practice, not enforced.** A node should
   end with one `sayAndListen`. Several exits multiply listen sets and make
   routing hard to explain. Prefer one node per case, with gate intentions
   routing between them. Studio allows several exits; the docs advise against
   them.

## Consequences

- **Positive:** Each part has one job: the scan routes, the node owns its data.
  A decision-model turn is one provider call; a chat model runs only when a node
  asks for it. A scan timeout no longer loses the caller's data — Node 2 still
  has `userText`. Routing is explainable from the intention alone.
- **Negative / trade-offs:** Breaking for apps that use `extract`: each field
  moves into the node that handles the answer. A node that needs a chat model to
  read messy input (spelled emails, addresses) makes that call itself, after the
  scan rather than alongside it, so such turns can take longer. Errors from
  `before()` now reach `catch()`; nodes with a custom `catch()` must expect them.
- **Follow-ups:** Runtime API, module setup, environment variables, conversation
  design and nodes-and-listens best practices; migration steps in the 0.2.0
  upgrade guide; projects built on Studio migrated before 0.2.0 sign-off.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep scan-time extraction through the delegate (ARD-0006 decision 6) | Two jobs per scan, a second provider call per turn, one timeout loses both, and Node 1 describes Node 2's data |
| Quality variants of intentions ("gave a good number") | Multiplies intentions and asks the scan to validate data it cannot check; triage belongs to the node |
| A Studio extraction helper (`ctx.extract(fields)`) | Nodes already have `ctx.clarify`, code and regex; a framework helper narrows choices without adding ability |
| Enforce one `sayAndListen` per node | Takes away freedom of development; advice is enough |
| Deprecate `extract` first, remove later | 0.2.0 is unpublished and already breaking; one migration is cheaper than two |

## References

- Related ARDs: [ARD-0006](./ARD-0006-decision-brain-drivers.md) (decision 6
  superseded), [ARD-0004](./ARD-0004-framework-decision-boundary.md)
- `docs/reference/runtime-api.md`: Brain, `sayAndListen`, Node lifecycle, `catch()`
