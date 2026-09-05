import type { PortalState, SupervisedStatus, TurnState } from './types';
import type { Variables } from './conversation-entry';
import type { ListenExpectation } from './listen-expectation';
import { type ConversationHistory } from './conversation-history';
export declare class SupervisedConversation {
    readonly runtimeInstanceId: string;
    readonly conversationId: string;
    readonly providerCallId: string;
    readonly flowId: string;
    createdAt: Date;
    /** Currently executing node id (portal or normal). */
    currentNodeId: string | null;
    /** Last normal (non-portal) flow node — survives portal interruptions. */
    normalFlowNodeId: string | null;
    brainProfileId: string;
    brainSequenceIndex: number;
    portalState: PortalState;
    memory: Record<string, unknown>;
    /** App-seeded basics for the whole Conversation (typed at the app boundary). */
    variables: Variables;
    /**
     * Active listen registration from the last Node (opened before its speech).
     * Next Brain scan uses this for intention boosts + hints.
     */
    listenExpectation: ListenExpectation | null;
    /**
     * False until flow.start Node has run() once.
     * Vapi Custom LLM "assistant speaks first" requires this opening turn
     * without a Brain intention scan.
     */
    openingCompleted: boolean;
    turn: TurnState;
    status: SupervisedStatus;
    metadata: Record<string, unknown>;
    /**
     * Compact transcript + node path for Brain scan and Node.before().
     * Session memory for the call — Chat Completions is stateless, so we
     * resend this rolling window instead of a vendor-side GPT thread.
     */
    history: ConversationHistory;
    /**
     * Full assistant utterances from the last completed turn (not compact history).
     * Replayed on a coalesced Custom LLM waiter so Vapi's *latest* HTTP request
     * still has speech — empty skip SSE is dead air.
     */
    lastAssistantSpeech: string[];
    constructor(input: {
        conversationId: string;
        providerCallId: string;
        flowId: string;
        brainProfileId: string;
        startNodeId: string;
        runtimeInstanceId?: string;
        metadata?: Record<string, unknown>;
        variables?: Variables;
    });
    enterPortal(portalNodeId: string): void;
    exitPortal(): string | null;
    enterNormalNode(nodeId: string): void;
    snapshot(): Record<string, unknown>;
    /** Rebuild an in-memory runtime from a DB checkpoint (crash recovery). */
    static fromSnapshot(raw: Record<string, unknown>): SupervisedConversation;
}
//# sourceMappingURL=supervised-conversation.d.ts.map