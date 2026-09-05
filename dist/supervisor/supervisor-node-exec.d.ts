import type { SupervisedConversation } from '../conversation/supervised-conversation';
import { type NodeContext, type AgentNode } from '../node/agent-node';
import { BufferedConversationOutput, type NodeResult } from '../output/conversation-output';
import type { FlowNodeDefinition } from '../flow/flow-loader';
import type { SupervisorEngine } from './supervisor.types';
export declare function executeNodeWithCatch(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    output: BufferedConversationOutput;
    node: AgentNode;
    candidate: FlowNodeDefinition;
    intentionName: string;
    ctx: NodeContext;
    restarts: number;
    forceHop: number;
}): Promise<{
    kind: 'done';
    result: NodeResult;
} | {
    kind: 'forceIntention';
    intention: string;
}>;
/**
 * Stamp the resolved listen window onto the active expectation.
 * sayAndListen timeout > listen() timeout > Node.listenTimeoutSeconds > default.
 */
export declare function stampListenTimeout(this: SupervisorEngine, runtime: SupervisedConversation, node: AgentNode, fromSayAndListen?: number): void;
export declare function enterPortal(this: SupervisorEngine, runtime: SupervisedConversation, candidate: FlowNodeDefinition): string | null | undefined;
export declare function enterNormal(this: SupervisorEngine, runtime: SupervisedConversation, candidate: FlowNodeDefinition): string | null | undefined;
/**
 * After a toolCall terminal action, remember which Node requested it so the
 * next Custom LLM turn with role:tool can re-enter without Brain scan.
 */
/**
 * After a toolCall terminal action, remember which Node requested it so the
 * next Custom LLM turn with role:tool can re-enter without Brain scan.
 */
export declare function stampPendingToolNode(this: SupervisorEngine, runtime: SupervisedConversation, result: NodeResult, selectedNodeId: string): void;
//# sourceMappingURL=supervisor-node-exec.d.ts.map