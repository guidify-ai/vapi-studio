import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { ChannelToolResult } from '../channel/channel-tools';
import type { SupervisorEngine } from './supervisor.types';
import type { TurnExecutionResult } from './supervisor.types';
export declare function handleTurn(this: SupervisorEngine, input: {
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
export declare function executeTurn(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    toolResults?: ChannelToolResult[];
    forceIntention?: string;
    onSay?: (text: string) => Promise<void>;
}): Promise<TurnExecutionResult>;
//# sourceMappingURL=supervisor-orchestration.d.ts.map