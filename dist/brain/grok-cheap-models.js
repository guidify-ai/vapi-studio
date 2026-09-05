"use strict";
/**
 * Whitelisted cheap xAI Grok models for studio-grok Brain (OpenAI-compatible API).
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHEAP_GROK_MODEL_IDS = exports.CHEAP_GROK_MODELS = exports.DEFAULT_CHEAP_GROK_MODEL = void 0;
exports.isCheapGrokModel = isCheapGrokModel;
exports.resolveCheapGrokModel = resolveCheapGrokModel;
/** Default — mini class suited to intention scoring + extract. */
exports.DEFAULT_CHEAP_GROK_MODEL = 'grok-3-mini';
exports.CHEAP_GROK_MODELS = {
    'grok-3-mini': {
        id: 'grok-3-mini',
        inputPerMillion: 0.3,
        outputPerMillion: 0.5,
        note: 'Default studio-grok',
    },
    'grok-4-fast-non-reasoning': {
        id: 'grok-4-fast-non-reasoning',
        inputPerMillion: 0.2,
        outputPerMillion: 0.5,
    },
    'grok-2-1212': {
        id: 'grok-2-1212',
        inputPerMillion: 2,
        outputPerMillion: 10,
    },
    'grok-2-latest': {
        id: 'grok-2-latest',
        inputPerMillion: 2,
        outputPerMillion: 10,
    },
};
exports.CHEAP_GROK_MODEL_IDS = Object.keys(exports.CHEAP_GROK_MODELS);
function isCheapGrokModel(model) {
    return Object.prototype.hasOwnProperty.call(exports.CHEAP_GROK_MODELS, model);
}
function resolveCheapGrokModel(value) {
    const raw = (value ?? exports.DEFAULT_CHEAP_GROK_MODEL).trim();
    if (!raw) {
        return exports.CHEAP_GROK_MODELS[exports.DEFAULT_CHEAP_GROK_MODEL];
    }
    if (!isCheapGrokModel(raw)) {
        throw new Error(`Grok Brain model "${raw}" is not on the studio-grok cheap whitelist. ` +
            `Set it in application code via VapiStudioModule.forRoot({ brain: { model } }). ` +
            `Allowed: ${exports.CHEAP_GROK_MODEL_IDS.join(', ')}.`);
    }
    return exports.CHEAP_GROK_MODELS[raw];
}
//# sourceMappingURL=grok-cheap-models.js.map