import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { ListenExpectation } from '../conversation/listen-expectation';
import { type CodeIntention } from '../intention/code-intention';
import type { BrainIntentionOption } from '../brain/brain-ranking';
import type { SupervisorEngine } from './supervisor.types';
import type { TurnExecutionResult } from './supervisor.types';
export declare function intentionList(this: SupervisorEngine): CodeIntention[];
/**
 * phase: 'force' — before listen/Brain. First before()===true wins (registry order).
 */
/**
 * phase: 'force' — before listen/Brain. First before()===true wins (registry order).
 */
export declare function tryForceIntentions(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
}): Promise<TurnExecutionResult | null>;
/**
 * phase: 'match' — local confidence; may skip Brain. goto from run() routes now.
 */
/**
 * phase: 'match' — local confidence; may skip Brain. goto from run() routes now.
 */
export declare function tryMatchIntentions(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
    confidenceThreshold: number;
}): Promise<{
    kind: 'routed';
    result: TurnExecutionResult;
} | {
    kind: 'score';
    name: string;
    confidence: number;
} | null>;
/**
 * Limited Brain candidate set for this listen:
 * - listen-prioritized next-node intentions (with boost + priority)
 * - registered CodeIntention boost/priority overlays
 * - all portal intentions (except: while in `mad`, only the mad portal — sticky)
 * - studio.isUnknownTransition (scan-failure global; not while sticky mad)
 * - if no listen yet: all normal-flow intentions + portals
 */
/**
 * Limited Brain candidate set for this listen:
 * - listen-prioritized next-node intentions (with boost + priority)
 * - registered CodeIntention boost/priority overlays
 * - all portal intentions (except: while in `mad`, only the mad portal — sticky)
 * - studio.isUnknownTransition (scan-failure global; not while sticky mad)
 * - if no listen yet: all normal-flow intentions + portals
 */
export declare function buildBrainCandidates(this: SupervisorEngine, listen: ListenExpectation | null | undefined, runtime?: SupervisedConversation): BrainIntentionOption[];
//# sourceMappingURL=supervisor-cascade.d.ts.map