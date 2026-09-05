/**
 * Whitelisted cheap Google Gemini models for studio-gemini Brain.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */
import type { LlmModelPricing } from './llm-model-pricing';
export type CheapGeminiModelId = 'gemini-2.0-flash' | 'gemini-2.0-flash-lite' | 'gemini-2.5-flash' | 'gemini-1.5-flash';
export type CheapGeminiModelPricing = LlmModelPricing & {
    id: CheapGeminiModelId;
};
/** Default — fast Flash suited to intention scoring + extract. */
export declare const DEFAULT_CHEAP_GEMINI_MODEL: CheapGeminiModelId;
export declare const CHEAP_GEMINI_MODELS: Record<CheapGeminiModelId, CheapGeminiModelPricing>;
export declare const CHEAP_GEMINI_MODEL_IDS: CheapGeminiModelId[];
export declare function isCheapGeminiModel(model: string): model is CheapGeminiModelId;
export declare function resolveCheapGeminiModel(value?: string | null): CheapGeminiModelPricing;
//# sourceMappingURL=gemini-cheap-models.d.ts.map