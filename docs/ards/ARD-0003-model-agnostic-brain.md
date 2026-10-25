# ARD-0003: Model-agnostic Brain adapters

- **Status:** Accepted
- **Date:** 2026-10-24
- **Tags:** framework | adapter | runtime

## Context

The stock JSON-LLM Brain adapters (OpenAI, Anthropic, Google, xAI) each shipped a
hardcoded "cheap whitelist" of model ids, a framework default model, a price
table, and fixed request settings (`temperature: 0`). That tied every Studio
release to one provider's model catalogue:

- OpenAI retired `gpt-4.1-nano`, the default, while it was still on the
  whitelist — every app without an explicit `brain.model` failed every scan.
- OpenAI deprecated the rest of the GPT-4 series (shutdown 2027-01-14). Its
  replacement, `gpt-6-luna`, rejects `temperature: 0`, so simply whitelisting it
  would also have failed every scan.
- Switching models required a new Studio version and an npm publish.

Which model an app uses is an application decision, like its flow or copy.

## Decision

1. **No model knowledge in the framework.** Remove the per-provider whitelists,
   default models, and price tables (`*-cheap-models.ts`).
2. **`brain.model` is required** for stock LLM adapters and passed through
   unchanged. Missing → the adapter throws a clear error (scan falls back to
   unknown, as for any provider failure).
3. **`brain.providerOptions`** is merged into the provider request body (plain
   objects one level deep). Studio sends no sampling settings of its own;
   apps add `temperature`, `reasoning_effort`, etc. as their model allows.
   Adapters keep only protocol requirements (JSON mode, Anthropic `max_tokens`).
4. **`brain.pricing`** (`inputPerMillion`, `outputPerMillion`) is optional and
   used only for usage estimates. Omitted → USD reported as 0.
5. Provider choice stays an adapter (`brainAdapter`); model choice is config.

## Consequences

- **Positive:** Provider model launches and retirements are an app config
  change, never a Studio release. No framework default can silently die.
- **Negative / trade-offs:** Breaking for apps that relied on the default model
  or imported whitelist helpers (`resolveCheap*Model`, `CHEAP_*_MODELS`,
  `DEFAULT_CHEAP_*_MODEL`, `lookupModelPricing`). Apps must set `brain.model`
  and, if they want deterministic sampling, `providerOptions`. Cost
  estimates need app-supplied pricing.
- **Follow-ups:** `Cheap*ModelId` types remain as deprecated `string` aliases
  so existing app code compiles; remove in a later minor.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep whitelist, add `gpt-6-luna` as default | Repeats the problem on the next deprecation; every model change needs a release |
| Per-model request quirks table in the framework | Same coupling, just more of it |
| Auto-retry without `temperature` on 400 | Guesswork on the live path; costs a round-trip inside the 3s budget |

## References

- `docs/reference/runtime-api.md` (Brain adapters, `brain` config)
- `docs/best-practices/brain-and-prompt-injection.md`
- OpenAI deprecations, 2026-10-14 (GPT-4 series)
