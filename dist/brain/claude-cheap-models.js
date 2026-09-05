"use strict";
/**
 * Whitelisted cheap Anthropic Claude models for studio-claude Brain.
 * Anything outside this set is rejected — no silent upgrade to expensive models.
 *
 * Prices are approximate USD per 1M tokens for PoC cost estimates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHEAP_CLAUDE_MODEL_IDS = exports.CHEAP_CLAUDE_MODELS = exports.DEFAULT_CHEAP_CLAUDE_MODEL = void 0;
exports.isCheapClaudeModel = isCheapClaudeModel;
exports.resolveCheapClaudeModel = resolveCheapClaudeModel;
/** Default — cheapest Haiku suited to intention scoring + extract. */
exports.DEFAULT_CHEAP_CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
exports.CHEAP_CLAUDE_MODELS = {
    'claude-haiku-4-5-20251001': {
        id: 'claude-haiku-4-5-20251001',
        inputPerMillion: 1,
        outputPerMillion: 5,
        note: 'Haiku 4.5 — default studio-claude',
    },
    'claude-3-5-haiku-latest': {
        id: 'claude-3-5-haiku-latest',
        inputPerMillion: 0.8,
        outputPerMillion: 4,
    },
    'claude-3-5-haiku-20241022': {
        id: 'claude-3-5-haiku-20241022',
        inputPerMillion: 0.8,
        outputPerMillion: 4,
    },
    'claude-3-haiku-20240307': {
        id: 'claude-3-haiku-20240307',
        inputPerMillion: 0.25,
        outputPerMillion: 1.25,
    },
};
exports.CHEAP_CLAUDE_MODEL_IDS = Object.keys(exports.CHEAP_CLAUDE_MODELS);
function isCheapClaudeModel(model) {
    return Object.prototype.hasOwnProperty.call(exports.CHEAP_CLAUDE_MODELS, model);
}
function resolveCheapClaudeModel(value) {
    const raw = (value ?? exports.DEFAULT_CHEAP_CLAUDE_MODEL).trim();
    if (!raw) {
        return exports.CHEAP_CLAUDE_MODELS[exports.DEFAULT_CHEAP_CLAUDE_MODEL];
    }
    if (!isCheapClaudeModel(raw)) {
        throw new Error(`Claude Brain model "${raw}" is not on the studio-claude cheap whitelist. ` +
            `Set it in application code via VapiStudioModule.forRoot({ brain: { model } }). ` +
            `Allowed: ${exports.CHEAP_CLAUDE_MODEL_IDS.join(', ')}.`);
    }
    return exports.CHEAP_CLAUDE_MODELS[raw];
}
//# sourceMappingURL=claude-cheap-models.js.map