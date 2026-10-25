# ARD-0006: Decision-model Brain drivers (OpenAI Decisions, TypeSafe Jev)

- **Status:** Accepted
- **Date:** 2026-10-25
- **Tags:** brain | adapters | intentions

## Context

Intention scanning is a classification problem: given the call so far, how
likely is each candidate intention? Studio's LLM adapters solve it by asking a
chat model to write JSON scores. That pays for output tokens, runs at chat
latency, and the scores are whatever the model chose to write.

Two providers now sell decision models that answer yes/no questions with a
calibrated probability and bill input tokens only:

- **OpenAI Decisions** — `POST /v1/decisions`, `predicate` questions (1–400 per
  request), JSON context via `input_json`, shared-prefix prompt caching.
- **TypeSafe Jev** — `POST /v1/systemone`, `noul` questions keyed by id, a
  `state` string or object, 64k-token context.

Both are cheaper per scan than an LLM (no output tokens) and faster. Neither can
generate text, so neither can extract field values or answer `clarify`.

A model that sees only the intention name (`wantsRepair`) guesses at its
meaning. Names were enough for LLM prompts that also saw the Node's hints; a
per-question probability model needs the meaning stated.

## Decision

1. **One predicate per candidate.** Scan sends one question per candidate:
   "Does the caller's latest turn express `<name>`? Meaning: `<description>`".
   Scores are independent probabilities (they need not sum to 1), clamped to
   0..1 and rounded to 6 decimals, then follow the existing threshold →
   `studio.isUnknownTransition` rules. Refused questions are skipped.
2. **Shared context.** Both drivers send the same JSON context: wrapped untrusted
   caller text, speech series, turn number, current Node / portal, hints, the last
   8 chat and Node history entries, and memory. One shared base
   (`DecisionBrainAdapter`) owns orchestration; providers implement only auth and
   one HTTP call.
3. **Descriptions are required for decision drivers.** Candidates carry
   `description`, resolved first non-empty from listen `intentions[]` →
   `CodeIntention.description` → flow.yaml `intentions` →
   `STANDARD_INTENTION_DESCRIPTIONS`. A missing description is an app bug: the
   scan logs an error and returns the unknown transition without calling the
   provider. LLM adapters receive descriptions too but do not require them.
4. **Memory goes to the scanner by default**, behind an app hook
   (`brain.memorySnapshot`) to trim or redact. The app decides what leaves the
   process (ARD-0004: app owns content). LLM scans receive memory too.
5. **Extraction is delegated.** `brain.delegate` names an LLM adapter + model.
   Listen `extract` fields go to `delegate.clarify` in parallel with scoring;
   `clarify()` and `judge()` forward to it. Without a delegate, extraction is
   skipped with an error log and `clarify` / `judge` throw a configuration error.

Built-in `studio.*` descriptions are model instructions, never spoken to callers,
so they sit on the framework side of ARD-0004 like the existing scan prompts.
Model ids and prices stay out of the framework (ARD-0003).

## Consequences

- Apps that switch to a decision driver must describe every intention a scan can
  see. Apps on LLM adapters are unaffected.
- A decision scan with listen extraction costs one decision call plus one LLM
  call; turns without extraction pay only the decision call.
- Scores are no longer mutually exclusive. Several intentions can clear the
  threshold; the Supervisor's priority walk already handles that.
- The JSON context counts against provider limits (OpenAI 256 KiB JSON, Jev 64k
  tokens). Large memories should be trimmed through `memorySnapshot`.
