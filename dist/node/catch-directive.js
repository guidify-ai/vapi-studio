"use strict";
/**
 * Node catch recovery directives — returned from AgentNode.catch().
 * Prefer helpers: restartNode(), forceIntention(...).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowUncertainError = void 0;
exports.restartNode = restartNode;
exports.forceIntention = forceIntention;
exports.catchResult = catchResult;
exports.rethrowCatch = rethrowCatch;
/** Re-run the same Node (listen → run) within the current turn. */
function restartNode() {
    return { kind: 'restartNode' };
}
/** Abort current Node and route this turn to the given intention. */
function forceIntention(intention) {
    return { kind: 'forceIntention', intention };
}
/** Finish the turn with an explicit output result (sayAndListen / endCall / …). */
function catchResult(result) {
    return { kind: 'result', result };
}
/** Let Supervisor rethrow the original error. */
function rethrowCatch() {
    return { kind: 'rethrow' };
}
/**
 * Thrown by Node logic when the flow cannot decide how to continue.
 * catch() can map this to restartNode / forceIntention / etc.
 */
class FlowUncertainError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.name = 'FlowUncertainError';
        this.details = details;
    }
}
exports.FlowUncertainError = FlowUncertainError;
//# sourceMappingURL=catch-directive.js.map