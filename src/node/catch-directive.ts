/**
 * Node catch recovery directives — returned from Ra9Node.catch().
 * Prefer helpers: restartNode(), forceIntention(...).
 */

import type { NodeResult } from '../output/conversation-output';

export type CatchDirective =
  | { kind: 'restartNode' }
  | { kind: 'forceIntention'; intention: string }
  | { kind: 'result'; result: NodeResult }
  | { kind: 'rethrow' };

/** Re-run the same Node (listen → run) within the current turn. */
export function restartNode(): CatchDirective {
  return { kind: 'restartNode' };
}

/** Abort current Node and route this turn to the given intention. */
export function forceIntention(intention: string): CatchDirective {
  return { kind: 'forceIntention', intention };
}

/** Finish the turn with an explicit output result (sayAndListen / endCall / …). */
export function catchResult(result: NodeResult): CatchDirective {
  return { kind: 'result', result };
}

/** Let Supervisor rethrow the original error. */
export function rethrowCatch(): CatchDirective {
  return { kind: 'rethrow' };
}

/**
 * Thrown by Node logic when the flow cannot decide how to continue.
 * catch() can map this to restartNode / forceIntention / etc.
 */
export class FlowUncertainError extends Error {
  public readonly details?: Record<string, unknown>;

  public constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'FlowUncertainError';
    this.details = details;
  }
}
