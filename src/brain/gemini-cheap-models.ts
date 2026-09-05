/**
 * Whitelisted cheap Google Gemini models for studio-gemini Brain.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */

import type { LlmModelPricing } from './llm-model-pricing';

export type CheapGeminiModelId =
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-1.5-flash';

export type CheapGeminiModelPricing = LlmModelPricing & {
  id: CheapGeminiModelId;
};

/** Default — fast Flash suited to intention scoring + extract. */
export const DEFAULT_CHEAP_GEMINI_MODEL: CheapGeminiModelId =
  'gemini-2.0-flash';

export const CHEAP_GEMINI_MODELS: Record<
  CheapGeminiModelId,
  CheapGeminiModelPricing
> = {
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
    note: 'Default studio-gemini',
  },
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
  },
};

export const CHEAP_GEMINI_MODEL_IDS = Object.keys(
  CHEAP_GEMINI_MODELS,
) as CheapGeminiModelId[];

export function isCheapGeminiModel(
  model: string,
): model is CheapGeminiModelId {
  return Object.prototype.hasOwnProperty.call(CHEAP_GEMINI_MODELS, model);
}

export function resolveCheapGeminiModel(
  value?: string | null,
): CheapGeminiModelPricing {
  const raw = (value ?? DEFAULT_CHEAP_GEMINI_MODEL).trim();
  if (!raw) {
    return CHEAP_GEMINI_MODELS[DEFAULT_CHEAP_GEMINI_MODEL];
  }
  if (!isCheapGeminiModel(raw)) {
    throw new Error(
      `Gemini Brain model "${raw}" is not on the studio-gemini cheap whitelist. ` +
        `Set it in application code via VapiStudioModule.forRoot({ brain: { model } }). ` +
        `Allowed: ${CHEAP_GEMINI_MODEL_IDS.join(', ')}.`,
    );
  }
  return CHEAP_GEMINI_MODELS[raw];
}
