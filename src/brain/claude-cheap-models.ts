/**
 * Whitelisted cheap Anthropic Claude models for studio-claude Brain.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */

import type { LlmModelPricing } from './llm-model-pricing';

export type CheapClaudeModelId =
  | 'claude-haiku-4-5-20251001'
  | 'claude-3-5-haiku-latest'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-haiku-20240307';

export type CheapClaudeModelPricing = LlmModelPricing & {
  id: CheapClaudeModelId;
};

/** Default — cheapest Haiku suited to intention scoring + extract. */
export const DEFAULT_CHEAP_CLAUDE_MODEL: CheapClaudeModelId =
  'claude-haiku-4-5-20251001';

export const CHEAP_CLAUDE_MODELS: Record<
  CheapClaudeModelId,
  CheapClaudeModelPricing
> = {
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    inputPerMillion: 1,
    outputPerMillion: 5,
    note: 'Haiku 4.5 — default studio-claude',
  },
  'claude-3-5-haiku-latest': {
    id: 'claude-3-5-haiku-latest',
    inputPerMillion: 0.8,
    outputPerMillion: 4,
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    inputPerMillion: 0.8,
    outputPerMillion: 4,
  },
  'claude-3-haiku-20240307': {
    id: 'claude-3-haiku-20240307',
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
  },
};

export const CHEAP_CLAUDE_MODEL_IDS = Object.keys(
  CHEAP_CLAUDE_MODELS,
) as CheapClaudeModelId[];

export function isCheapClaudeModel(
  model: string,
): model is CheapClaudeModelId {
  return Object.prototype.hasOwnProperty.call(CHEAP_CLAUDE_MODELS, model);
}

export function resolveCheapClaudeModel(
  value?: string | null,
): CheapClaudeModelPricing {
  const raw = (value ?? DEFAULT_CHEAP_CLAUDE_MODEL).trim();
  if (!raw) {
    return CHEAP_CLAUDE_MODELS[DEFAULT_CHEAP_CLAUDE_MODEL];
  }
  if (!isCheapClaudeModel(raw)) {
    throw new Error(
      `Claude Brain model "${raw}" is not on the studio-claude cheap whitelist. ` +
        `Set it in application code via VapiStudioModule.forRoot({ brain: { model } }). ` +
        `Allowed: ${CHEAP_CLAUDE_MODEL_IDS.join(', ')}.`,
    );
  }
  return CHEAP_CLAUDE_MODELS[raw];
}
