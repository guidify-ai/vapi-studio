import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { NodeResult, OutputAction } from '../output/conversation-output';
import type { BrainService } from '../brain/brain.service';
import type { StudioBrainConfig } from '../brain/brain-config';
import type { ResolvedConversationLimits } from '../conversation/conversation-limits';
import type { ConversationBootstrapService } from '../conversation/conversation-bootstrap.service';
import type { EventService } from '../events/event.service';
import type { FormsService } from '../forms/forms.service';
import type { FlowLoader } from '../flow/flow-loader';
import type { IntegrationClient } from '../integrations/integration-client';
import type { CodeIntentionRegistry } from '../intention/code-intention';
import type { AgentNodeRegistry } from '../node/agent-node';
/** Max Node.catch → restartNode loops per turn. */
export declare const MAX_NODE_RESTARTS = 2;
/** Max forceIntention / continue hops within one turn. */
export declare const MAX_FORCE_INTENTION_HOPS = 3;
export interface TurnExecutionResult {
    runtime: SupervisedConversation;
    intentionNames: string[];
    selectedNodeId: string;
    selectedClass: string;
    result: NodeResult;
    actions: OutputAction[];
    portalOriginRestored?: string | null;
    extracted?: Record<string, unknown>;
}
/** Injectable services shared by all Supervisor method modules. */
export interface SupervisorServices {
    brain: BrainService;
    flowLoader: FlowLoader;
    nodes: AgentNodeRegistry;
    events: EventService;
    /** Optional in unit tests; checkpoint is try/caught. */
    bootstrap?: ConversationBootstrapService;
    integrations?: IntegrationClient;
    forms?: FormsService;
    brainConfig?: StudioBrainConfig;
    intentions?: CodeIntentionRegistry;
    conversationLimits?: ResolvedConversationLimits;
}
/**
 * Full engine: services + methods from focused modules.
 * `import()` type queries avoid runtime circular deps.
 */
export type SupervisorEngine = SupervisorServices & {
    handleTurn: typeof import('./supervisor-orchestration').handleTurn;
    executeTurn: typeof import('./supervisor-orchestration').executeTurn;
    enforceConversationLimits: typeof import('./supervisor-limits').enforceConversationLimits;
    executeModuleEntryTurn: typeof import('./supervisor-special-turns').executeModuleEntryTurn;
    executeOpeningTurn: typeof import('./supervisor-special-turns').executeOpeningTurn;
    executeToolResultTurn: typeof import('./supervisor-special-turns').executeToolResultTurn;
    routeIntentions: typeof import('./supervisor-route').routeIntentions;
    resolveViaForWinner: typeof import('./supervisor-route').resolveViaForWinner;
    emitRouteDecision: typeof import('./supervisor-route').emitRouteDecision;
    isContinueNode: typeof import('./supervisor-portal').isContinueNode;
    isStillThereNode: typeof import('./supervisor-portal').isStillThereNode;
    isUnknownPortalActive: typeof import('./supervisor-portal').isUnknownPortalActive;
    tryUnknownOriginConsume: typeof import('./supervisor-portal').tryUnknownOriginConsume;
    resolveOriginListenForReplay: typeof import('./supervisor-portal').resolveOriginListenForReplay;
    replayOriginAfterContinue: typeof import('./supervisor-portal').replayOriginAfterContinue;
    executeNodeWithCatch: typeof import('./supervisor-node-exec').executeNodeWithCatch;
    stampListenTimeout: typeof import('./supervisor-node-exec').stampListenTimeout;
    enterPortal: typeof import('./supervisor-node-exec').enterPortal;
    enterNormal: typeof import('./supervisor-node-exec').enterNormal;
    stampPendingToolNode: typeof import('./supervisor-node-exec').stampPendingToolNode;
    intentionList: typeof import('./supervisor-cascade').intentionList;
    tryForceIntentions: typeof import('./supervisor-cascade').tryForceIntentions;
    tryMatchIntentions: typeof import('./supervisor-cascade').tryMatchIntentions;
    buildBrainCandidates: typeof import('./supervisor-cascade').buildBrainCandidates;
};
//# sourceMappingURL=supervisor.types.d.ts.map