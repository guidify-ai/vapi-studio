import { Repository } from 'typeorm';
import { ConversationEntity } from './conversation.entity';
import { ConversationEventEntity } from './conversation-event.entity';
import type { ConversationStatus } from '../conversation/types';
/** Pull caller id from bootstrap metadata / snapshot bags. */
export declare function extractCallerIdFromBags(...bags: Array<Record<string, unknown> | null | undefined>): string | null;
export interface ResumableConversation {
    conversationId: string;
    providerCallId: string;
    status: ConversationStatus;
    /** Best snapshot for clone (finalState preferred, else runtimeState). */
    state: Record<string, unknown>;
    activityAt: Date;
}
export declare class ConversationRepository {
    private readonly conversations;
    private readonly events;
    constructor(conversations: Repository<ConversationEntity>, events: Repository<ConversationEventEntity>);
    createActive(input: {
        projectId: string;
        providerCallId: string;
        runtimeInstanceId: string;
        metadata?: Record<string, unknown>;
        provider?: string;
        callerId?: string | null;
    }): Promise<ConversationEntity>;
    findByProviderCallId(providerCallId: string, projectId?: string): Promise<ConversationEntity | null>;
    findById(conversationId: string): Promise<ConversationEntity | null>;
    /** ACTIVE rows that have a checkpoint (eligible for crash restore). */
    listActiveWithState(): Promise<ConversationEntity[]>;
    listActive(): Promise<ConversationEntity[]>;
    /** Recent conversations for operator debug UIs (newest first). */
    listRecent(input?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        items: ConversationEntity[];
        total: number;
    }>;
    /** Ended conversations with a final_state snapshot (for analytics backfill). */
    listEndedWithFinalState(input: {
        projectId: string;
        since?: Date;
        limit?: number;
    }): Promise<ConversationEntity[]>;
    /**
     * Latest ENDED (with final_state) or abandoned ACTIVE (with runtime_state)
     * for this caller within the window, excluding the current conversation.
     */
    findResumableForCaller(input: {
        callerId: string;
        withinMs: number;
        excludeConversationId?: string;
    }): Promise<ResumableConversation | null>;
    saveRuntimeCheckpoint(input: {
        conversationId: string;
        runtimeState: Record<string, unknown>;
        callerId?: string | null;
    }): Promise<void>;
    markEnded(input: {
        conversationId: string;
        finalState: Record<string, unknown>;
        callerId?: string | null;
    }): Promise<void>;
    appendEvent(input: {
        conversationId: string;
        type: string;
        payload?: Record<string, unknown>;
    }): Promise<void>;
    listEvents(conversationId: string): Promise<ConversationEventEntity[]>;
    countConversationsByProject(input: {
        projectId: string;
        since?: Date;
    }): Promise<{
        total: number;
        active: number;
        ended: number;
    }>;
    /**
     * Distinct conversations per event type for a project (top tags / funnel).
     */
    countConversationsByEventType(input: {
        projectId: string;
        since?: Date;
        types?: string[];
        limit?: number;
    }): Promise<Array<{
        type: string;
        conversations: number;
        events: number;
    }>>;
    /**
     * Distinct conversations that hit ANALYTICS_TAG with a given payload.tag.
     */
    countConversationsByAnalyticsTag(input: {
        projectId: string;
        since?: Date;
        limit?: number;
    }): Promise<Array<{
        tag: string;
        conversations: number;
        events: number;
    }>>;
    /**
     * Distinct conversations matching a funnel step.
     * - Default: any of `eventTypes` OR any of `tags` (OR).
     * - Outcome steps: `requireAllTags` (AND) with optional `excludeTags`.
     * - Legacy: when `funnelId` is set with `tags`, also filter payload.funnels.
     */
    countConversationsMatchingStep(input: {
        projectId: string;
        since?: Date;
        eventTypes?: string[];
        tags?: string[];
        requireAllTags?: string[];
        excludeTags?: string[];
        /** @deprecated Prefer catalog-only scoring (omit). */
        funnelId?: string;
    }): Promise<number>;
    /**
     * Conversations that have every `requireTags` ANALYTICS_TAG and none of
     * `excludeTags` (within the optional since window on matching events).
     */
    countConversationsMatchingTagRules(input: {
        projectId: string;
        since?: Date;
        requireTags: string[];
        excludeTags?: string[];
    }): Promise<number>;
    /** Top conversation path signatures (CONVERSATION_PATH events). */
    countTopConversationPaths(input: {
        projectId: string;
        since?: Date;
        limit?: number;
    }): Promise<Array<{
        signature: string;
        branchLabel: string;
        nodes: string[];
        conversations: number;
    }>>;
    /** Distinct conversations per CALL_OUTCOME payload.outcome. */
    countConversationsByCallOutcome(input: {
        projectId: string;
        since?: Date;
    }): Promise<Array<{
        outcome: string;
        conversations: number;
        events: number;
    }>>;
    /**
     * Duration percentiles (seconds) for ENDED conversations:
     * `ended_at - created_at`. Returns null percentiles when sample is empty.
     */
    callDurationPercentiles(input: {
        projectId: string;
        since?: Date;
        /** Inclusive 0–1 values, e.g. 0.8 / 0.9. */
        percentiles?: number[];
    }): Promise<{
        sampleSize: number;
        /** Keys like `p80`, `p90` → seconds (rounded to 1 decimal) or null. */
        valuesSec: Record<string, number | null>;
    }>;
    /**
     * Distinct conversations matching any of the event matchers (OR).
     * Optional `payloadEquals` ANDs `payload->>key = value` for that matcher.
     */
    countConversationsMatchingEventMatchers(input: {
        projectId: string;
        since?: Date;
        matchers: Array<{
            type: string;
            payloadEquals?: Record<string, string>;
        }>;
    }): Promise<number>;
    /**
     * Copy all events from one conversation onto another.
     * Preserves original type; stamps clone provenance into payload.
     */
    cloneEvents(input: {
        fromConversationId: string;
        toConversationId: string;
    }): Promise<number>;
}
//# sourceMappingURL=conversation.repository.d.ts.map