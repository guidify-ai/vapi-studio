/**
 * Shared model pricing shape + multi-provider USD estimates for Brain usage.
 */

import {
  CHEAP_OPENAI_MODELS,
  isCheapOpenAiModel,
} from './openai-cheap-models';
import {
  CHEAP_CLAUDE_MODELS,
  isCheapClaudeModel,
} from './claude-cheap-models';
import {
  CHEAP_GEMINI_MODELS,
  isCheapGeminiModel,
} from './gemini-cheap-models';
import {
  CHEAP_GROK_MODELS,
  isCheapGrokModel,
} from './grok-cheap-models';

export interface LlmModelPricing {
  /** Display / API model id. */
  id: string;
  /** USD per 1M input tokens. */
  inputPerMillion: number;
  /** USD per 1M output tokens. */
  outputPerMillion: number;
  note?: string;
}

export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export function lookupModelPricing(model: string): LlmModelPricing | null {
  if (isCheapOpenAiModel(model)) return CHEAP_OPENAI_MODELS[model];
  if (isCheapClaudeModel(model)) return CHEAP_CLAUDE_MODELS[model];
  if (isCheapGeminiModel(model)) return CHEAP_GEMINI_MODELS[model];
  if (isCheapGrokModel(model)) return CHEAP_GROK_MODELS[model];
  return null;
}

export function estimateUsdFromPricing(
  pricing: LlmModelPricing | null | undefined,
  promptTokens: number,
  completionTokens: number,
): number {
  if (!pricing) return 0;
  const inCost =
    (Math.max(0, promptTokens) / 1_000_000) * pricing.inputPerMillion;
  const outCost =
    (Math.max(0, completionTokens) / 1_000_000) * pricing.outputPerMillion;
  return inCost + outCost;
}

/**
 * Approximate USD from any stock Brain cheap whitelist (OpenAI / Claude / Gemini / Grok).
 * Unknown models → 0 (still track tokens).
 */
export function estimateUsdCost(input: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  return estimateUsdFromPricing(
    lookupModelPricing(input.model),
    input.promptTokens,
    input.completionTokens,
  );
}
