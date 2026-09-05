/**
 * Whitelisted cheap Anthropic Claude models for studio-claude Brain.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */
import type { LlmModelPricing } from './llm-model-pricing';
export type CheapClaudeModelId = 'claude-haiku-4-5-20251001' | 'claude-3-5-haiku-latest' | 'claude-3-5-haiku-20241022' | 'claude-3-haiku-20240307';
export type CheapClaudeModelPricing = LlmModelPricing & {
    id: CheapClaudeModelId;
};
/** Default — cheapest Haiku suited to intention scoring + extract. */
export declare const DEFAULT_CHEAP_CLAUDE_MODEL: CheapClaudeModelId;
export declare const CHEAP_CLAUDE_MODELS: Record<CheapClaudeModelId, CheapClaudeModelPricing>;
export declare const CHEAP_CLAUDE_MODEL_IDS: CheapClaudeModelId[];
export declare function isCheapClaudeModel(model: string): model is CheapClaudeModelId;
export declare function resolveCheapClaudeModel(value?: string | null): CheapClaudeModelPricing;
//# sourceMappingURL=claude-cheap-models.d.ts.map