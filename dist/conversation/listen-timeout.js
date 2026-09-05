"use strict";
/**
 * How long the channel waits after a user pause before closing a listen.
 *
 * Vapi's default `onPunctuationSeconds` is 0.1 — a transcribed "K." ends the
 * turn before "as soon as possible" lands. Vapi Studio's default is long enough to
 * catch trailing speech; Nodes override via `listenTimeoutSeconds`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LISTEN_TIMEOUT_SECONDS = exports.MIN_LISTEN_TIMEOUT_SECONDS = exports.DEFAULT_LISTEN_TIMEOUT_SECONDS = void 0;
exports.clampListenTimeoutSeconds = clampListenTimeoutSeconds;
exports.resolveListenTimeoutSeconds = resolveListenTimeoutSeconds;
exports.listenTimeoutSecondsToMs = listenTimeoutSecondsToMs;
exports.listenTimeoutToVapiStartSpeakingPlan = listenTimeoutToVapiStartSpeakingPlan;
/** Default listen window in seconds (Node class + channel hold). */
exports.DEFAULT_LISTEN_TIMEOUT_SECONDS = 2.5;
/** Shortest listen window (Vapi waitSeconds floor is 0.4). */
exports.MIN_LISTEN_TIMEOUT_SECONDS = 0.4;
/** Longest listen window — long dictation (address) needs room after pauses. */
exports.MAX_LISTEN_TIMEOUT_SECONDS = 12;
function clampListenTimeoutSeconds(value) {
    if (!Number.isFinite(value)) {
        return exports.DEFAULT_LISTEN_TIMEOUT_SECONDS;
    }
    return Math.min(exports.MAX_LISTEN_TIMEOUT_SECONDS, Math.max(exports.MIN_LISTEN_TIMEOUT_SECONDS, value));
}
/**
 * Resolve listen timeout: sayAndListen → listen() → Node class → default.
 */
function resolveListenTimeoutSeconds(input) {
    const raw = input.fromSayAndListen ??
        input.fromListen ??
        input.fromNode ??
        exports.DEFAULT_LISTEN_TIMEOUT_SECONDS;
    return clampListenTimeoutSeconds(raw);
}
function listenTimeoutSecondsToMs(timeoutSeconds) {
    return Math.round(clampListenTimeoutSeconds(timeoutSeconds ?? exports.DEFAULT_LISTEN_TIMEOUT_SECONDS) * 1000);
}
/**
 * Map a listen timeout onto Vapi endpointing so punctuation like "K." does
 * not close the user turn at the 0.1s default.
 */
function listenTimeoutToVapiStartSpeakingPlan(timeoutSeconds = exports.DEFAULT_LISTEN_TIMEOUT_SECONDS) {
    const seconds = clampListenTimeoutSeconds(timeoutSeconds);
    return {
        customEndpointingRules: [
            { type: 'assistant', regex: '.', timeoutSeconds: seconds },
        ],
        transcriptionEndpointingPlan: {
            onPunctuationSeconds: seconds,
            onNoPunctuationSeconds: seconds,
            onNumberSeconds: seconds,
        },
    };
}
//# sourceMappingURL=listen-timeout.js.map