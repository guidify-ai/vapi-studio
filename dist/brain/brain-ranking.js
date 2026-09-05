"use strict";
/**
 * Pure helpers for ranked intention JSON + unknown-transition fallback.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIDENCE_DECIMALS = exports.DEFAULT_BRAIN_CONFIDENCE_THRESHOLD = void 0;
exports.resolveConfidenceThreshold = resolveConfidenceThreshold;
exports.roundConfidence = roundConfidence;
exports.clamp01 = clamp01;
exports.resolveIntentionPriority = resolveIntentionPriority;
exports.allBelowConfidenceThreshold = allBelowConfidenceThreshold;
exports.scoresToRankedCandidates = scoresToRankedCandidates;
exports.compareIntentionWalkOrder = compareIntentionWalkOrder;
exports.orderIntentionsForWalk = orderIntentionsForWalk;
exports.selectWalkableIntentions = selectWalkableIntentions;
const conversation_history_1 = require("../conversation/conversation-history");
exports.DEFAULT_BRAIN_CONFIDENCE_THRESHOLD = 0.4;
exports.CONFIDENCE_DECIMALS = 6;
function resolveConfidenceThreshold(explicit) {
    if (typeof explicit === 'number' && Number.isFinite(explicit)) {
        return roundConfidence(clamp01(explicit));
    }
    return exports.DEFAULT_BRAIN_CONFIDENCE_THRESHOLD;
}
/** Clamp to [0, 1] then round to 6 decimal places. Never above 1. */
function roundConfidence(n) {
    return Number(clamp01(n).toFixed(exports.CONFIDENCE_DECIMALS));
}
function clamp01(n) {
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.min(1, Math.max(0, n));
}
function resolveIntentionPriority(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return conversation_history_1.DEFAULT_INTENTION_PRIORITY;
    }
    return value;
}
/** True when every scored intention is below the confidence threshold. */
function allBelowConfidenceThreshold(scores, threshold) {
    if (!scores.length) {
        return true;
    }
    return scores.every((s) => roundConfidence(s.confidence ?? 0) < threshold);
}
/**
 * Convert model scores into IntentionCandidates.
 * Boost is recorded as a hint; it does not change Supervisor walk order.
 */
function scoresToRankedCandidates(scores, options, meta = {}) {
    const byName = new Map(options.map((o) => [o.name, o]));
    return scores.map((s) => {
        const confidence = roundConfidence(s.confidence);
        const option = byName.get(s.name);
        const boost = option?.boost ?? 0;
        const priority = resolveIntentionPriority(option?.priority);
        return {
            name: s.name,
            confidence,
            priority,
            rank: Math.round((1 - confidence) * 1_000_000),
            payload: {
                ...meta,
                confidence,
                reason: s.reason,
                listenBoost: boost || undefined,
                priority,
            },
        };
    });
}
/**
 * Supervisor walk order: higher priority first, then name A–Z.
 */
function compareIntentionWalkOrder(a, b) {
    const pa = resolveIntentionPriority(a.priority);
    const pb = resolveIntentionPriority(b.priority);
    if (pb !== pa)
        return pb - pa;
    return a.name.localeCompare(b.name);
}
function orderIntentionsForWalk(intentions) {
    return [...intentions].sort(compareIntentionWalkOrder);
}
/**
 * Drop scores below threshold, except always keep isUnknownTransition
 * when it is the only remaining / fallback candidate.
 */
function selectWalkableIntentions(intentions, threshold, unknownName) {
    const eligible = intentions.filter((i) => i.name === unknownName ||
        roundConfidence(i.confidence) >= threshold);
    if (eligible.length) {
        return orderIntentionsForWalk(eligible);
    }
    const unknown = intentions.find((i) => i.name === unknownName);
    if (unknown) {
        return [unknown];
    }
    return [];
}
//# sourceMappingURL=brain-ranking.js.map