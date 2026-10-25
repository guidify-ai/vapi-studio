# ARD-0004: Framework decision boundary

- **Status:** Accepted
- **Date:** 2026-10-24
- **Tags:** framework | runtime | policy

## Context

[ARD-0003](./ARD-0003-model-agnostic-brain.md) removed model whitelists and price
tables: facts that belong to a provider had been frozen into the framework and
went stale. An audit of every remaining decision Studio makes on the app's
behalf found more of the same kind — business vocabulary, caller-facing copy, a
country assumption, and ceilings the app could not raise.

Studio needs one rule for which decisions are its own.

## Decision

Every decision falls into exactly one class:

| Class | Owner | Framework may… |
| --- | --- | --- |
| **Invariant** — safety, correctness, Vapi protocol | Framework | Enforce it; not configurable |
| **Mechanism tuning** — timeouts, windows, sizes | Framework default, app override | Ship a default **only if the app can override it** |
| **App content** — anything a caller hears or reads, language, country, business vocabulary, provider/model choice | App | Nothing. No default; require it, or leave it out |
| **Remote fact** — prices, model catalogues, provider limits | Provider | Nothing. Never copy; the remote is the source of truth |

Opt-in helpers (HTML form pages, spoken-email parsing) may ship starter defaults
for app content, because the app chooses to call them — but every visible string
must be an option.

### Inventory (0.2.0)

**Changed:**

| Decision | Was | Class | Now |
| --- | --- | --- | --- |
| Mock name extractor stop words | Included one project's business words | App content (one project's vocabulary) | Generic words only |
| Limit goodbye line | English default "We've been talking for a while…" | App content | `limits.endMessage` **required** (boot error) |
| Turn / duration ceilings | Clamped to 150 turns / 60 min | Mechanism tuning | Any finite value; defaults 40 / 20 min stay; limits still cannot be disabled |
| Listen timeout ceiling | Clamped to 12 s | Mechanism tuning | No ceiling; Vapi's 0.4 s floor stays (protocol) |
| LLM Brain timeout | Hardcoded 3 s | Mechanism tuning | `brain.timeoutMs`, default 3000 |
| SMS national numbers | 10 digits → `+1` (North America) | App content (country) | E.164 only; app normalizes |
| SMS text | English default "Please fill out this short form" | App content | `disposeContext.body` **required**, `{formUrl}` placeholder |
| Default Brain adapter | Silent `MockBrainAdapter` when omitted | App choice | `brainAdapter` **required** (boot error) |
| Form "gone" page title, `<html lang>` | Fixed English | App content (opt-in helper) | Options |

**Kept, with reason:**

| Decision | Class | Why it stays |
| --- | --- | --- |
| Limits always on | Invariant | A call must end; Studio checks at turn boundaries |
| Node restart / force-hop guards (2 / 3) | Invariant | Loop protection, not product behaviour |
| Prompt-injection guard, extracted-string cap (256) | Invariant | Safety floor on untrusted input |
| Vapi tool-name defaults (`end_call_tool`, `transferCall`, `handoff`) | Invariant (protocol) | Overridable by env and matched against tools Vapi advertises — the remote stays the source of truth |
| Listen timeout floor 0.4 s | Remote fact, enforced | Vapi rejects lower; failing earlier is clearer |
| Defaults: listen 2.5 s, confidence 0.4, form ACK 15 s, fill-out 10 min, resume 10 min, log retention 14 days | Mechanism tuning | Each is overridable (Node/listen, `brain`, env, form spec, `withinMs`, `LOG_DAYS`) |
| Scan history size (8 chat / 8 nodes), compaction sizes | Mechanism (internal) | Prompt-construction detail, not an app-visible behaviour |
| English Brain system prompts | Mechanism (internal) | Instructions to the model, never spoken to a caller |
| English mock yes/no parsing | Mechanism (tests) | `MockBrainAdapter` only; live adapters extract via the model |
| `parseSpokenEmail` English rules | Opt-in helper | Apps call it explicitly |
| Form page English text | Opt-in helper | Apps call the renderers; every string is an option |
| Provider API URLs | Invariant (protocol) | The adapter *is* the protocol binding |

## Consequences

- **Positive:** No customer vocabulary in the framework; no caller-facing English
  unless the app opts into a helper; no hidden country; apps with long calls,
  long dictation, or slow models are no longer capped by Studio.
- **Negative / trade-offs:** Breaking for apps that relied on defaults:
  - `limits.endMessage` and `brainAdapter` are required in `forRoot`.
  - `TwilioSmsFormDisposeAdapter` needs E.164 `contactPhone` and `disposeContext.body`.
  - Removed exports: `HARD_MAX_CONVERSATION_TURNS`, `HARD_MAX_CONVERSATION_DURATION_MS`,
    `DEFAULT_CONVERSATION_LIMIT_MESSAGE`, `MAX_LISTEN_TIMEOUT_SECONDS`, `buildDefaultSmsBody`.
    `resolveSmsBody` now returns `null` when the app sent no body.
  - A `Supervisor` constructed outside `forRoot` (tests) still enforces default
    bounds but ends the call without speech — there are no app words to say.
- **Follow-ups:** New framework code is reviewed against the table above. A
  default that the app cannot override, or any caller-facing literal outside an
  opt-in helper, needs its own ARD.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep English defaults, document "override in production" | Silent: an app that forgets ships Studio's words to its callers |
| Locale packs in the framework | The framework would own translations of copy it should not own at all |
| Raise the ceilings instead of removing them | Still a number Studio picked for someone else's product |
| `defaultCountry` option for SMS | A second phone-normalization layer; the app already knows the country where it collects the number |

## References

- [ARD-0002](./ARD-0002-vapi-only-north-star.md), [ARD-0003](./ARD-0003-model-agnostic-brain.md)
- `docs/reference/runtime-api.md` (limits, `brain`, forms)
- `docs/guide/forms.md`
- `.specify/memory/constitution.md` (framework free of customer behaviour)
