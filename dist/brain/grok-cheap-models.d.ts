/**
 * Whitelisted cheap xAI Grok models for studio-grok Brain (OpenAI-compatible API).
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */
import type { LlmModelPricing } from './llm-model-pricing';
export type CheapGrokModelId = 'grok-3-mini' | 'grok-4-fast-non-reasoning' | 'grok-2-1212' | 'grok-2-latest';
export type CheapGrokModelPricing = LlmModelPricing & {
    id: CheapGrokModelId;
};
/** Default — mini class suited to intention scoring + extract. */
export declare const DEFAULT_CHEAP_GROK_MODEL: CheapGrokModelId;
export declare const CHEAP_GROK_MODELS: Record<CheapGrokModelId, CheapGrokModelPricing>;
export declare const CHEAP_GROK_MODEL_IDS: CheapGrokModelId[];
export declare function isCheapGrokModel(model: string): model is CheapGrokModelId;
export declare function resolveCheapGrokModel(value?: string | null): CheapGrokModelPricing;
//# sourceMappingURL=grok-cheap-models.d.ts.map