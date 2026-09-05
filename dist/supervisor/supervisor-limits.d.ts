import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { SupervisorEngine } from './supervisor.types';
import type { TurnExecutionResult } from './supervisor.types';
export declare function enforceConversationLimits(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    onSay?: (text: string) => Promise<void>;
}): Promise<TurnExecutionResult | null>;
//# sourceMappingURL=supervisor-limits.d.ts.map