"use strict";
/**
 * Brain judge — LLM-as-a-judge.
 * Rare on the live call path; the primary consumer is eval tests.
 *
 * Given stringifiable context + a plain-language goal + success/failure
 * criteria, adapters return pass/fail, reasoning bullets, and confidence.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIDENCE_6_PATTERN = exports.DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD = void 0;
exports.resolveJudgeConfidenceThreshold = resolveJudgeConfidenceThreshold;
exports.clampConfidence = clampConfidence;
exports.formatConfidence6 = formatConfidence6;
exports.isConfidence6 = isConfidence6;
exports.normalizeReasoning = normalizeReasoning;
exports.judgeContextToString = judgeContextToString;
exports.normalizeJudgeResult = normalizeJudgeResult;
const brain_ranking_1 = require("./brain-ranking");
/** Default: no confidence floor — callers opt in via options.confidenceThreshold. */
exports.DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD = 0;
/** Confidence as a fixed 6-decimal string, e.g. "0.850000". Always matches /^\d\.\d{6}$/. */
exports.CONFIDENCE_6_PATTERN = /^\d\.\d{6}$/;
function resolveJudgeConfidenceThreshold(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return exports.DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD;
    }
    return Math.min(1, Math.max(0, value));
}
function clampConfidence(value) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        return 0;
    return (0, brain_ranking_1.clamp01)(n);
}
/** Clamp to [0, 1] and format as `\d.\d\d\d\d\d\d`. */
function formatConfidence6(value) {
    return clampConfidence(value).toFixed(brain_ranking_1.CONFIDENCE_DECIMALS);
}
function isConfidence6(value) {
    return exports.CONFIDENCE_6_PATTERN.test(value);
}
function normalizeReasoning(raw) {
    if (!Array.isArray(raw)) {
        if (typeof raw === 'string' && raw.trim())
            return [raw.trim()];
        return [];
    }
    return raw
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}
/**
 * JSON-stringify objects; pass strings through.
 * Prefer this over clarifiableInputToString so `{foo:1}` is not `[object Object]`.
 */
function judgeContextToString(context) {
    if (context === null || context === undefined)
        return '';
    if (typeof context === 'string')
        return context;
    if (typeof context === 'number' ||
        typeof context === 'boolean' ||
        typeof context === 'bigint') {
        return String(context);
    }
    if (context instanceof Date) {
        return context.toISOString();
    }
    try {
        return JSON.stringify(context);
    }
    catch {
        try {
            return String(context);
        }
        catch {
            return '';
        }
    }
}
/**
 * Normalize raw Brain JSON into a judge result.
 * `passed` is the model judgment; threshold only sets `belowThreshold`.
 */
function normalizeJudgeResult(raw, options) {
    const threshold = resolveJudgeConfidenceThreshold(options?.confidenceThreshold);
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw
        : {};
    const passed = obj.passed === true ||
        obj.verdict === true ||
        (typeof obj.passed === 'string' &&
            /^(true|pass|passed|yes)$/i.test(obj.passed));
    const confidence = formatConfidence6(obj.confidence);
    const reasoning = normalizeReasoning(obj.reasoning);
    const belowThreshold = Number(confidence) < threshold;
    if (!reasoning.length) {
        reasoning.push(Object.keys(obj).length === 0
            ? 'invalid_judge_payload'
            : passed
                ? 'passed'
                : 'failed');
    }
    return {
        passed,
        reasoning,
        confidence,
        belowThreshold,
    };
}
//# sourceMappingURL=brain-judge.js.map