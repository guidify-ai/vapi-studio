"use strict";
/**
 * Shared model pricing shape + multi-provider USD estimates for Brain usage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupModelPricing = lookupModelPricing;
exports.estimateUsdFromPricing = estimateUsdFromPricing;
exports.estimateUsdCost = estimateUsdCost;
const openai_cheap_models_1 = require("./openai-cheap-models");
const claude_cheap_models_1 = require("./claude-cheap-models");
const gemini_cheap_models_1 = require("./gemini-cheap-models");
const grok_cheap_models_1 = require("./grok-cheap-models");
function lookupModelPricing(model) {
    if ((0, openai_cheap_models_1.isCheapOpenAiModel)(model))
        return openai_cheap_models_1.CHEAP_OPENAI_MODELS[model];
    if ((0, claude_cheap_models_1.isCheapClaudeModel)(model))
        return claude_cheap_models_1.CHEAP_CLAUDE_MODELS[model];
    if ((0, gemini_cheap_models_1.isCheapGeminiModel)(model))
        return gemini_cheap_models_1.CHEAP_GEMINI_MODELS[model];
    if ((0, grok_cheap_models_1.isCheapGrokModel)(model))
        return grok_cheap_models_1.CHEAP_GROK_MODELS[model];
    return null;
}
function estimateUsdFromPricing(pricing, promptTokens, completionTokens) {
    if (!pricing)
        return 0;
    const inCost = (Math.max(0, promptTokens) / 1_000_000) * pricing.inputPerMillion;
    const outCost = (Math.max(0, completionTokens) / 1_000_000) * pricing.outputPerMillion;
    return inCost + outCost;
}
/**
 * Approximate USD from any stock Brain cheap whitelist (OpenAI / Claude / Gemini / Grok).
 * Unknown models → 0 (still track tokens).
 */
function estimateUsdCost(input) {
    return estimateUsdFromPricing(lookupModelPricing(input.model), input.promptTokens, input.completionTokens);
}
//# sourceMappingURL=llm-model-pricing.js.map