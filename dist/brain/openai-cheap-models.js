"use strict";
/**
 * Whitelisted cheap OpenAI models for studio-chatgpt Brain testing.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens (standard, non-batch) for PoC cost estimates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHEAP_OPENAI_MODEL_IDS = exports.CHEAP_OPENAI_MODELS = exports.DEFAULT_CHEAP_OPENAI_MODEL = void 0;
exports.isCheapOpenAiModel = isCheapOpenAiModel;
exports.resolveCheapOpenAiModel = resolveCheapOpenAiModel;
exports.estimateUsdCost = estimateUsdCost;
/** Default for PoC — cheapest classified routing / extract model. */
exports.DEFAULT_CHEAP_OPENAI_MODEL = 'gpt-4.1-nano';
exports.CHEAP_OPENAI_MODELS = {
    'gpt-4.1-nano': {
        id: 'gpt-4.1-nano',
        inputPerMillion: 0.1,
        outputPerMillion: 0.4,
        note: 'Cheapest; good for intention scoring + extract',
    },
    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        inputPerMillion: 0.15,
        outputPerMillion: 0.6,
    },
    'gpt-4.1-mini': {
        id: 'gpt-4.1-mini',
        inputPerMillion: 0.4,
        outputPerMillion: 1.6,
    },
    'gpt-5.4-nano': {
        id: 'gpt-5.4-nano',
        inputPerMillion: 0.2,
        outputPerMillion: 1.25,
    },
};
exports.CHEAP_OPENAI_MODEL_IDS = Object.keys(exports.CHEAP_OPENAI_MODELS);
function isCheapOpenAiModel(model) {
    return Object.prototype.hasOwnProperty.call(exports.CHEAP_OPENAI_MODELS, model);
}
/**
 * Resolve a cheap OpenAI model id against the whitelist.
 * Pass the id from application code (`VapiStudioModule.forRoot({ brain: { model } })`).
 * Default: gpt-4.1-nano. Throws if an expensive / unknown model is requested.
 */
function resolveCheapOpenAiModel(value) {
    const raw = (value ?? exports.DEFAULT_CHEAP_OPENAI_MODEL).trim();
    if (!raw) {
        return exports.CHEAP_OPENAI_MODELS[exports.DEFAULT_CHEAP_OPENAI_MODEL];
    }
    if (!isCheapOpenAiModel(raw)) {
        throw new Error(`OpenAI Brain model "${raw}" is not on the studio-chatgpt cheap whitelist. ` +
            `Set it in application code via VapiStudioModule.forRoot({ brain: { model } }). ` +
            `Allowed: ${exports.CHEAP_OPENAI_MODEL_IDS.join(', ')}.`);
    }
    return exports.CHEAP_OPENAI_MODELS[raw];
}
/** @deprecated Prefer `estimateUsdCost` from `llm-model-pricing` (multi-provider). */
function estimateUsdCost(input) {
    const pricing = isCheapOpenAiModel(input.model)
        ? exports.CHEAP_OPENAI_MODELS[input.model]
        : null;
    if (!pricing) {
        return 0;
    }
    const inCost = (Math.max(0, input.promptTokens) / 1_000_000) * pricing.inputPerMillion;
    const outCost = (Math.max(0, input.completionTokens) / 1_000_000) *
        pricing.outputPerMillion;
    return inCost + outCost;
}
//# sourceMappingURL=openai-cheap-models.js.map