"use strict";
/**
 * Hard caps on conversation length — fail-closed goodbye + endCall.
 * Every call must have finite turn and wall-clock bounds.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONVERSATION_LIMIT_MESSAGE = exports.HARD_MAX_CONVERSATION_DURATION_MS = exports.HARD_MAX_CONVERSATION_TURNS = exports.DEFAULT_MAX_CONVERSATION_DURATION_MS = exports.DEFAULT_MAX_CONVERSATION_TURNS = exports.STUDIO_CONVERSATION_LIMITS = void 0;
exports.resolveConversationLimits = resolveConversationLimits;
exports.evaluateConversationLimits = evaluateConversationLimits;
exports.STUDIO_CONVERSATION_LIMITS = Symbol('STUDIO_CONVERSATION_LIMITS');
/** Default: 40 Supervisor turns (opening + user/tool/force/entry-speak). */
exports.DEFAULT_MAX_CONVERSATION_TURNS = 40;
/** Default: 20 minutes from runtime `createdAt`. */
exports.DEFAULT_MAX_CONVERSATION_DURATION_MS = 20 * 60 * 1000;
/** Soft ceiling — apps may raise, not beyond. */
exports.HARD_MAX_CONVERSATION_TURNS = 150;
/** Soft ceiling — apps may raise, not beyond (60 minutes). */
exports.HARD_MAX_CONVERSATION_DURATION_MS = 60 * 60 * 1000;
exports.DEFAULT_CONVERSATION_LIMIT_MESSAGE = "We've been talking for a while, so I'm going to end this call now. Please call back if you still need help.";
function resolveConversationLimits(input) {
    const maxTurns = clampInt(input?.maxTurns, exports.DEFAULT_MAX_CONVERSATION_TURNS, 1, exports.HARD_MAX_CONVERSATION_TURNS);
    const maxDurationMs = clampInt(input?.maxDurationMs, exports.DEFAULT_MAX_CONVERSATION_DURATION_MS, 1_000, exports.HARD_MAX_CONVERSATION_DURATION_MS);
    const endMessage = typeof input?.endMessage === 'string' && input.endMessage.trim()
        ? input.endMessage.trim()
        : exports.DEFAULT_CONVERSATION_LIMIT_MESSAGE;
    return { maxTurns, maxDurationMs, endMessage };
}
function evaluateConversationLimits(input) {
    const now = input.now ?? new Date();
    const elapsedMs = Math.max(0, now.getTime() - input.createdAt.getTime());
    if (input.turnNumber > input.limits.maxTurns) {
        return { exceeded: true, reason: 'max_turns', elapsedMs };
    }
    if (elapsedMs > input.limits.maxDurationMs) {
        return { exceeded: true, reason: 'max_duration', elapsedMs };
    }
    return { exceeded: false, elapsedMs };
}
function clampInt(raw, fallback, min, max) {
    if (typeof raw !== 'number' || !Number.isFinite(raw))
        return fallback;
    return Math.min(max, Math.max(min, Math.floor(raw)));
}
//# sourceMappingURL=conversation-limits.js.map