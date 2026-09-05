/**
 * Node catch recovery directives — returned from AgentNode.catch().
 * Prefer helpers: restartNode(), forceIntention(...).
 */
import type { NodeResult } from '../output/conversation-output';
export type CatchDirective = {
    kind: 'restartNode';
} | {
    kind: 'forceIntention';
    intention: string;
} | {
    kind: 'result';
    result: NodeResult;
} | {
    kind: 'rethrow';
};
/** Re-run the same Node (listen → run) within the current turn. */
export declare function restartNode(): CatchDirective;
/** Abort current Node and route this turn to the given intention. */
export declare function forceIntention(intention: string): CatchDirective;
/** Finish the turn with an explicit output result (sayAndListen / endCall / …). */
export declare function catchResult(result: NodeResult): CatchDirective;
/** Let Supervisor rethrow the original error. */
export declare function rethrowCatch(): CatchDirective;
/**
 * Thrown by Node logic when the flow cannot decide how to continue.
 * catch() can map this to restartNode / forceIntention / etc.
 */
export declare class FlowUncertainError extends Error {
    readonly details?: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>);
}
//# sourceMappingURL=catch-directive.d.ts.map