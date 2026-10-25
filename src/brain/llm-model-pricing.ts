/**
 * Brain usage USD estimates. Prices come from the app (`brain.pricing`);
 * Studio ships no price table.
 */

import type { BrainModelPricing } from './brain-config';

/** Model the stock adapters call: provider id plus optional app pricing. */
export interface LlmModelPricing {
  /** Provider model id. */
  id: string;
  pricing?: BrainModelPricing;
}

export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export function estimateUsdFromPricing(
  pricing: BrainModelPricing | null | undefined,
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

/** Approximate USD for one call. No pricing → 0 (tokens still tracked). */
export function estimateUsdCost(input: {
  pricing?: BrainModelPricing | null;
  promptTokens: number;
  completionTokens: number;
}): number {
  return estimateUsdFromPricing(
    input.pricing,
    input.promptTokens,
    input.completionTokens,
  );
}
