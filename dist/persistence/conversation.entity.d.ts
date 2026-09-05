import type { ConversationStatus } from '../conversation/types';
export declare class ConversationEntity {
    id: string;
    /** Owning project (ingress UUID). */
    projectId: string;
    provider: string;
    providerCallId: string;
    status: ConversationStatus;
    /**
     * Stable caller key for cross-call resume (phone ANI or Studio cookie).
     * Refreshed on checkpoint/finalize when the channel learns the id late.
     */
    callerId: string | null;
    runtimeInstanceId: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    endedAt: Date | null;
    /** Bumped on every checkpoint / finalize — drives the resume window. */
    lastActivityAt: Date | null;
    /**
     * Latest durable SupervisedConversation snapshot while ACTIVE (crash recovery).
     * Updated after each Supervisor turn. Cleared / superseded by finalState on end.
     */
    runtimeState: Record<string, unknown> | null;
    finalState: Record<string, unknown> | null;
}
//# sourceMappingURL=conversation.entity.d.ts.map