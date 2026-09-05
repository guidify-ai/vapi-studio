/**
 * Whitelisted cheap OpenAI models for studio-chatgpt Brain testing.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens (standard, non-batch) for PoC cost estimates.
 */
export type CheapOpenAiModelId = 'gpt-4.1-nano' | 'gpt-4o-mini' | 'gpt-4.1-mini' | 'gpt-5.4-nano';
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
export declare const DEFAULT_CHEAP_OPENAI_MODEL: CheapOpenAiModelId;
export declare const CHEAP_OPENAI_MODELS: Record<CheapOpenAiModelId, CheapModelPricing>;
export declare const CHEAP_OPENAI_MODEL_IDS: CheapOpenAiModelId[];
export declare function isCheapOpenAiModel(model: string): model is CheapOpenAiModelId;
/**
 * Resolve a cheap OpenAI model id against the whitelist.
 * Pass the id from application code (`VapiStudioModule.forRoot({ brain: { model } })`).
 * Default: gpt-4.1-nano. Throws if an expensive / unknown model is requested.
 */
export declare function resolveCheapOpenAiModel(value?: string | null): CheapModelPricing;
/** @deprecated Prefer `estimateUsdCost` from `llm-model-pricing` (multi-provider). */
export declare function estimateUsdCost(input: {
    model: string;
    promptTokens: number;
    completionTokens: number;
}): number;
//# sourceMappingURL=openai-cheap-models.d.ts.map