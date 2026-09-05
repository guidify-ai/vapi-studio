import type { SupervisedConversation } from '../conversation/supervised-conversation';
import { type ListenExpectation } from '../conversation/listen-expectation';
import { BufferedConversationOutput, type NodeResult } from '../output/conversation-output';
import type { FlowNodeDefinition } from '../flow/flow-loader';
import type { SupervisorEngine } from './supervisor.types';
/** Continue / isContinue is an escape hatch back to the pre-portal node. */
export declare function isContinueNode(this: SupervisorEngine, candidate: FlowNodeDefinition): boolean;
export declare function isStillThereNode(this: SupervisorEngine, candidate: FlowNodeDefinition): boolean;
/** True when the active portal owns `studio.isUnknownTransition`. */
/** True when the active portal owns `studio.isUnknownTransition`. */
export declare function isUnknownPortalActive(this: SupervisorEngine, runtime: SupervisedConversation): boolean;
/**
 * While in unknown recovery, try the origin’s listen (snapshot or refresh).
 * If the utterance resolves / ranks as a non-unknown product (or portal)
 * intention, exit the portal and route that intention on this turn — do not
 * re-scan against unknown’s thin candidate list.
 */
/**
 * While in unknown recovery, try the origin’s listen (snapshot or refresh).
 * If the utterance resolves / ranks as a non-unknown product (or portal)
 * intention, exit the portal and route that intention on this turn — do not
 * re-scan against unknown’s thin candidate list.
 */
export declare function tryUnknownOriginConsume(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    forceHop: number;
}): Promise<{
    intentionNames: string[];
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    portalOriginRestored?: string | null;
} | null>;
/**
 * Origin listen for Continue / unknown consume: prefer the snapshot taken at
 * portal enter (keeps `sayAndListen` overrides + resolveIntention).
 */
/**
 * Origin listen for Continue / unknown consume: prefer the snapshot taken at
 * portal enter (keeps `sayAndListen` overrides + resolveIntention).
 */
export declare function resolveOriginListenForReplay(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    originId: string;
    preferSaved: boolean;
    clearSaved: boolean;
}): Promise<ListenExpectation | null>;
/**
 * Exit the active portal (if any), restore the origin Node, refresh its
 * listen, re-scan the same user text, and route again — without speaking a
 * filler “Okay, continuing.”
 */
/**
 * Exit the active portal (if any), restore the origin Node, refresh its
 * listen, re-scan the same user text, and route again — without speaking a
 * filler “Okay, continuing.”
 */
export declare function replayOriginAfterContinue(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    forceHop: number;
    fromNodeId: string;
    resolvedVia?: string;
}): Promise<{
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    portalOriginRestored?: string | null;
}>;
//# sourceMappingURL=supervisor-portal.d.ts.map