import type { SupervisedConversation } from './supervised-conversation';
/**
 * App-defined conversation variables, typed at the application boundary.
 *
 * @example
 * export interface RoofrPoCVariables {
 *   companyName: string;
 * }
 * type Vars = Variables<RoofrPoCVariables>;
 */
export type Variables<T extends object = object> = T;
export interface ConversationEntryInput {
    providerCallId: string;
    metadata?: Record<string, unknown>;
}
/** Context passed to conversation setup/teardown hooks. */
export interface ConversationHookContext<TVars extends object = object> {
    runtime: SupervisedConversation;
    variables: Variables<TVars>;
}
/**
 * Conversation entry point — seeds typed variables and optional setup/teardown hooks.
 * Nodes read variables via `ctx.conversation.variables`.
 */
export interface ConversationEntryPoint<TVars extends object = object> {
    createVariables(input: ConversationEntryInput): Variables<TVars> | Promise<Variables<TVars>>;
    /** Setup hook — runs once when a Conversation is created (after variables are seeded). */
    beforeEach?(ctx: ConversationHookContext<TVars>): void | Promise<void>;
    /** Teardown hook — runs once when a Conversation is finalized/ended. */
    afterEach?(ctx: ConversationHookContext<TVars>): void | Promise<void>;
}
export declare const CONVERSATION_ENTRY_POINT: unique symbol;
export declare class DefaultConversationEntry implements ConversationEntryPoint<object> {
    createVariables(): object;
    beforeEach(_ctx: ConversationHookContext<object>): Promise<void>;
    afterEach(_ctx: ConversationHookContext<object>): Promise<void>;
}
//# sourceMappingURL=conversation-entry.d.ts.map