import { type BrainService } from '../brain/brain.service';
import { type StudioBrainConfig } from '../brain/brain-config';
import { type ResolvedConversationLimits } from '../conversation/conversation-limits';
import { ConversationBootstrapService } from '../conversation/conversation-bootstrap.service';
import type { SupervisedConversation } from '../conversation/supervised-conversation';
import { EventService } from '../events/event.service';
import { FormsService } from '../forms/forms.service';
import { FlowLoader } from '../flow/flow-loader';
import { IntegrationClient } from '../integrations/integration-client';
import { type CodeIntentionRegistry } from '../intention/code-intention';
import { type AgentNodeRegistry } from '../node/agent-node';
import type { ChannelToolResult } from '../channel/channel-tools';
import type { TurnExecutionResult } from './supervisor.types';
export type { TurnExecutionResult } from './supervisor.types';
/**
 * Nest facade for turn orchestration.
 *
 * Implementation is split across focused modules assembled by
 * `createSupervisorEngine`:
 * - `supervisor-orchestration` — handleTurn / executeTurn
 * - `supervisor-limits` — max turns / duration fail-closed endCall
 * - `supervisor-special-turns` — opening / module entry / tool-result
 * - `supervisor-cascade` — force / match / Brain candidates
 * - `supervisor-route` — walk candidates → node
 * - `supervisor-portal` — continue / unknown-origin consume
 * - `supervisor-node-exec` — listen/run/catch + portal enter/exit
 */
export declare class Supervisor {
    private readonly engine;
    constructor(brain: BrainService, flowLoader: FlowLoader, nodes: AgentNodeRegistry, events: EventService, bootstrap: ConversationBootstrapService, integrations?: IntegrationClient, forms?: FormsService, brainConfig?: StudioBrainConfig, intentions?: CodeIntentionRegistry, conversationLimits?: ResolvedConversationLimits);
    handleTurn(input: {
        runtime: SupervisedConversation;
        userText: string;
        /** Channel tool results from this Custom LLM request (`role:tool`). */
        toolResults?: ChannelToolResult[];
        /**
         * Force a known intention (idle portal, synthetic still-there, …)
         * without Brain scan.
         */
        forceIntention?: string;
        onSay?: (text: string) => Promise<void>;
    }): Promise<TurnExecutionResult>;
}
//# sourceMappingURL=supervisor.d.ts.map