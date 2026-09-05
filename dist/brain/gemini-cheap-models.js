"use strict";
/**
 * Whitelisted cheap Google Gemini models for studio-gemini Brain.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHEAP_GEMINI_MODEL_IDS = exports.CHEAP_GEMINI_MODELS = exports.DEFAULT_CHEAP_GEMINI_MODEL = void 0;
exports.isCheapGeminiModel = isCheapGeminiModel;
exports.resolveCheapGeminiModel = resolveCheapGeminiModel;
/** Default — fast Flash suited to intention scoring + extract. */
exports.DEFAULT_CHEAP_GEMINI_MODEL = 'gemini-2.0-flash';
exports.CHEAP_GEMINI_MODELS = {
    'gemini-2.0-flash': {
        id: 'gemini-2.0-flash',
        inputPerMillion: 0.1,
        outputPerMillion: 0.4,
        note: 'Default studio-gemini',
    },
    'gemini-2.0-flash-lite': {
        id: 'gemini-2.0-flash-lite',
        inputPerMillion: 0.075,
        outputPerMillion: 0.3,
    },
    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        inputPerMillion: 0.15,
        outputPerMillion: 0.6,
    },
    'gemini-1.5-flash': {
        id: 'gemini-1.5-flash',
        inputPerMillion: 0.075,
        outputPerMillion: 0.3,
    },
};
exports.CHEAP_GEMINI_MODEL_IDS = Object.keys(exports.CHEAP_GEMINI_MODELS);
function isCheapGeminiModel(model) {
    return Object.prototype.hasOwnProperty.call(exports.CHEAP_GEMINI_MODELS, model);
}
function resolveCheapGeminiModel(value) {
    const raw = (value ?? exports.DEFAULT_CHEAP_GEMINI_MODEL).trim();
    if (!raw) {
        return exports.CHEAP_GEMINI_MODELS[exports.DEFAULT_CHEAP_GEMINI_MODEL];
    }
    if (!isCheapGeminiModel(raw)) {
        throw new Error(`Gemini Brain model "${raw}" is not on the studio-gemini cheap whitelist. ` +
            `Set it in application code via VapiStudioModule.forRoot({ brain: { model } }). ` +
            `Allowed: ${exports.CHEAP_GEMINI_MODEL_IDS.join(', ')}.`);
    }
    return exports.CHEAP_GEMINI_MODELS[raw];
}
//# sourceMappingURL=gemini-cheap-models.js.map