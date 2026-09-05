import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { IntentionCandidate } from '../conversation/types';
import type { ListenExpectation } from '../conversation/listen-expectation';
import { BufferedConversationOutput, type NodeResult } from '../output/conversation-output';
import { type RouteRejectRow, type RouteWinnerRow } from '../events/route-forensics';
import type { SupervisorEngine } from './supervisor.types';
export declare function routeIntentions(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    ranked: IntentionCandidate[];
    forceHop: number;
    resolvedVia?: string;
    confidenceThreshold?: number;
    activeListen?: ListenExpectation | null;
    allowMiss: true;
}): Promise<{
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    portalOriginRestored?: string | null;
} | null>;
export declare function routeIntentions(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    ranked: IntentionCandidate[];
    forceHop: number;
    resolvedVia?: string;
    confidenceThreshold?: number;
    activeListen?: ListenExpectation | null;
    allowMiss?: false;
}): Promise<{
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    portalOriginRestored?: string | null;
}>;
export declare function resolveViaForWinner(this: SupervisorEngine, resolvedVia: string | undefined, intentionName: string, forceHop: number): string;
/** Durable + console forensic: why this node won (or none did). */
/** Durable + console forensic: why this node won (or none did). */
export declare function emitRouteDecision(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    resolvedVia: string;
    confidenceThreshold?: number;
    activeListen?: ListenExpectation | null;
    ranked: IntentionCandidate[];
    rejected: RouteRejectRow[];
    winner: RouteWinnerRow | null;
    failed?: boolean;
}): Promise<void>;
//# sourceMappingURL=supervisor-route.d.ts.map