/**
 * Whitelisted cheap xAI Grok models for studio-grok Brain (OpenAI-compatible API).
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */

import type { LlmModelPricing } from './llm-model-pricing';

export type CheapGrokModelId =
  | 'grok-3-mini'
  | 'grok-4-fast-non-reasoning'
  | 'grok-2-1212'
  | 'grok-2-latest';

export type CheapGrokModelPricing = LlmModelPricing & {
  id: CheapGrokModelId;
};

/** Default — mini class suited to intention scoring + extract. */
export const DEFAULT_CHEAP_GROK_MODEL: CheapGrokModelId = 'grok-3-mini';

export const CHEAP_GROK_MODELS: Record<
  CheapGrokModelId,
  CheapGrokModelPricing
> = {
  'grok-3-mini': {
    id: 'grok-3-mini',
    inputPerMillion: 0.3,
    outputPerMillion: 0.5,
    note: 'Default studio-grok',
  },
  'grok-4-fast-non-reasoning': {
    id: 'grok-4-fast-non-reasoning',
    inputPerMillion: 0.2,
    outputPerMillion: 0.5,
  },
  'grok-2-1212': {
    id: 'grok-2-1212',
    inputPerMillion: 2,
    outputPerMillion: 10,
  },
  'grok-2-latest': {
    id: 'grok-2-latest',
    inputPerMillion: 2,
    outputPerMillion: 10,
  },
};

export const CHEAP_GROK_MODEL_IDS = Object.keys(
  CHEAP_GROK_MODELS,
) as CheapGrokModelId[];

export function isCheapGrokModel(model: string): model is CheapGrokModelId {
  return Object.prototype.hasOwnProperty.call(CHEAP_GROK_MODELS, model);
}

export function resolveCheapGrokModel(
  value?: string | null,
): CheapGrokModelPricing {
  const raw = (value ?? DEFAULT_CHEAP_GROK_MODEL).trim();
  if (!raw) {
    return CHEAP_GROK_MODELS[DEFAULT_CHEAP_GROK_MODEL];
  }
  if (!isCheapGrokModel(raw)) {
    throw new Error(
      `Grok Brain model "${raw}" is not on the studio-grok cheap whitelist. ` +
        `Set it in application code via VapiStudioModule.forRoot({ brain: { model } }). ` +
        `Allowed: ${CHEAP_GROK_MODEL_IDS.join(', ')}.`,
    );
  }
  return CHEAP_GROK_MODELS[raw];
}
