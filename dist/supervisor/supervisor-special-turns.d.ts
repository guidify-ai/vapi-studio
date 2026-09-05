import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { SupervisorEngine } from './supervisor.types';
import type { TurnExecutionResult } from './supervisor.types';
/**
 * Speak the active module's current/entry Node after WORKFLOW_HANDOFF
 * (does not toggle openingCompleted).
 */
export declare function executeModuleEntryTurn(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
}): Promise<TurnExecutionResult>;
/**
 * First Custom LLM turn: execute flow.start Node.run() so the assistant
 * speaks before any user utterance / Brain routing.
 */
/**
 * First Custom LLM turn: execute flow.start Node.run() so the assistant
 * speaks before any user utterance / Brain routing.
 */
export declare function executeOpeningTurn(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
}): Promise<TurnExecutionResult>;
/**
 * Tool-result-only Custom LLM turn — re-run the Node that emitted toolCall.
 */
export declare function executeToolResultTurn(this: SupervisorEngine, input: {
    runtime: SupervisedConversation;
    userText: string;
    onSay?: (text: string) => Promise<void>;
}): Promise<TurnExecutionResult>;
//# sourceMappingURL=supervisor-special-turns.d.ts.map