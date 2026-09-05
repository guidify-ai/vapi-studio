/**
 * Shared model pricing shape + multi-provider USD estimates for Brain usage.
 */
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
export declare function lookupModelPricing(model: string): LlmModelPricing | null;
export declare function estimateUsdFromPricing(pricing: LlmModelPricing | null | undefined, promptTokens: number, completionTokens: number): number;
/**
 * Approximate USD from any stock Brain cheap whitelist (OpenAI / Claude / Gemini / Grok).
 * Unknown models → 0 (still track tokens).
 */
export declare function estimateUsdCost(input: {
    model: string;
    promptTokens: number;
    completionTokens: number;
}): number;
//# sourceMappingURL=llm-model-pricing.d.ts.map