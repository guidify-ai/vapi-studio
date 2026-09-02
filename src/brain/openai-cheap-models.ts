/**
 * Whitelisted cheap OpenAI models for ra9-chatgpt Brain testing.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens (standard, non-batch) for PoC cost estimates.
 */

export type CheapOpenAiModelId =
  | 'gpt-4.1-nano'
  | 'gpt-4o-mini'
  | 'gpt-4.1-mini'
  | 'gpt-5.4-nano';

export interface CheapModelPricing {
  /** Display / API model id. */
  id: CheapOpenAiModelId;
  /** USD per 1M input tokens. */
  inputPerMillion: number;
  /** USD per 1M output tokens. */
  outputPerMillion: number;
  note?: string;
}

/** Default for PoC — cheapest classified routing / extract model. */
export const DEFAULT_CHEAP_OPENAI_MODEL: CheapOpenAiModelId = 'gpt-4.1-nano';

export const CHEAP_OPENAI_MODELS: Record<CheapOpenAiModelId, CheapModelPricing> =
  {
    'gpt-4.1-nano': {
      id: 'gpt-4.1-nano',
      inputPerMillion: 0.1,
      outputPerMillion: 0.4,
      note: 'Cheapest; good for intention scoring + extract',
    },
    'gpt-4o-mini': {
      id: 'gpt-4o-mini',
      inputPerMillion: 0.15,
      outputPerMillion: 0.6,
    },
    'gpt-4.1-mini': {
      id: 'gpt-4.1-mini',
      inputPerMillion: 0.4,
      outputPerMillion: 1.6,
    },
    'gpt-5.4-nano': {
      id: 'gpt-5.4-nano',
      inputPerMillion: 0.2,
      outputPerMillion: 1.25,
    },
  };

export const CHEAP_OPENAI_MODEL_IDS = Object.keys(
  CHEAP_OPENAI_MODELS,
) as CheapOpenAiModelId[];

export function isCheapOpenAiModel(model: string): model is CheapOpenAiModelId {
  return Object.prototype.hasOwnProperty.call(CHEAP_OPENAI_MODELS, model);
}

/**
 * Resolve a cheap OpenAI model id against the whitelist.
 * Pass the id from application code (`Ra9Module.forRoot({ brain: { model } })`).
 * Default: gpt-4.1-nano. Throws if an expensive / unknown model is requested.
 */
export function resolveCheapOpenAiModel(
  value?: string | null,
): CheapModelPricing {
  const raw = (value ?? DEFAULT_CHEAP_OPENAI_MODEL).trim();
  if (!raw) {
    return CHEAP_OPENAI_MODELS[DEFAULT_CHEAP_OPENAI_MODEL];
  }
  if (!isCheapOpenAiModel(raw)) {
    throw new Error(
      `OpenAI Brain model "${raw}" is not on the ra9-chatgpt cheap whitelist. ` +
        `Set it in application code via Ra9Module.forRoot({ brain: { model } }). ` +
        `Allowed: ${CHEAP_OPENAI_MODEL_IDS.join(', ')}.`,
    );
  }
  return CHEAP_OPENAI_MODELS[raw];
}

export function estimateUsdCost(input: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const pricing = isCheapOpenAiModel(input.model)
    ? CHEAP_OPENAI_MODELS[input.model]
    : null;
  if (!pricing) {
    return 0;
  }
  const inCost =
    (Math.max(0, input.promptTokens) / 1_000_000) * pricing.inputPerMillion;
  const outCost =
    (Math.max(0, input.completionTokens) / 1_000_000) *
    pricing.outputPerMillion;
  return inCost + outCost;
}
