"use strict";
/**
 * Application-supplied Brain settings (code layer, not .env).
 * Secrets (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / XAI_API_KEY) stay in the environment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STUDIO_BRAIN_CONFIG = void 0;
exports.resolveStudioBrainConfig = resolveStudioBrainConfig;
const brain_ranking_1 = require("./brain-ranking");
exports.STUDIO_BRAIN_CONFIG = Symbol('STUDIO_BRAIN_CONFIG');
function resolveStudioBrainConfig(input) {
    return {
        model: input?.model?.trim() || undefined,
        confidenceThreshold: typeof input?.confidenceThreshold === 'number' &&
            Number.isFinite(input.confidenceThreshold)
            ? input.confidenceThreshold
            : brain_ranking_1.DEFAULT_BRAIN_CONFIDENCE_THRESHOLD,
    };
}
//# sourceMappingURL=brain-config.js.map