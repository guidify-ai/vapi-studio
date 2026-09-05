/**
 * Compact conversation history for Brain scan + Node.before().
 * Lives on the in-memory SupervisedConversation for the active call.
 */
export declare const DEFAULT_INTENTION_PRIORITY = 1;
export declare const MAX_COMPACT_CHAT_MESSAGES = 24;
export declare const MAX_COMPACT_CHAT_CHARS = 280;
export declare const MAX_NODE_PATH = 40;
export interface CompactChatMessage {
    role: 'user' | 'assistant';
    text: string;
}
export interface NodeVisit {
    nodeId: string;
    intention: string;
    turnNumber: number;
    at: string;
}
export interface ConversationHistory {
    /** Rolling compact transcript (user + bot). */
    chat: CompactChatMessage[];
    /** Node path for before() (where we have been). */
    nodes: NodeVisit[];
}
export declare function emptyConversationHistory(): ConversationHistory;
export declare function compactText(text: string, max?: number): string;
export declare function appendChat(history: ConversationHistory, role: 'user' | 'assistant', text: string): void;
export declare function appendNodeVisit(history: ConversationHistory, visit: NodeVisit): void;
export declare function countNodeVisits(history: ConversationHistory, nodeId: string): number;
export declare function lastVisitedNodeId(history: ConversationHistory): string | null;
//# sourceMappingURL=conversation-history.d.ts.map