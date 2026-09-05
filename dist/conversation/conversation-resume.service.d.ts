import type { SupervisedConversation } from './supervised-conversation';
import { EventService } from '../events/event.service';
import { ConversationRepository, type ResumableConversation } from '../persistence/conversation.repository';
import { SupervisedConversationRegistry } from './supervised-conversation.registry';
import { CallTurnQueueRegistry } from './call-turn-queue';
import { BrainUsageTracker } from '../brain/brain-usage.tracker';
/** Default window for “continue where you left off?” */
export declare const DEFAULT_RESUME_WITHIN_MS: number;
export interface ResumePeekResult {
    prior: ResumableConversation;
    summary: {
        activeModuleId: string | null;
        currentNodeId: string | null;
        firstName: string | null;
    };
}
/**
 * Cross-call resume: find a recent Conversation for the same caller and
 * clone its durable state into the **current** call (new providerCallId).
 *
 * Avoids injecting ConversationBootstrapService (Entry↔Bootstrap cycle).
 */
export declare class ConversationResumeService {
    private readonly conversations;
    private readonly events;
    private readonly registry;
    private readonly turnQueues;
    private readonly brainUsage;
    constructor(conversations: ConversationRepository, events: EventService, registry: SupervisedConversationRegistry, turnQueues: CallTurnQueueRegistry, brainUsage: BrainUsageTracker);
    peek(input: {
        callerId: string;
        excludeConversationId: string;
        withinMs?: number;
    }): Promise<ResumePeekResult | null>;
    applyCloneByConversationId(runtime: SupervisedConversation, priorConversationId: string): Promise<boolean>;
    applyClone(runtime: SupervisedConversation, prior: ResumableConversation): Promise<void>;
    private sealAbandonedPrior;
}
//# sourceMappingURL=conversation-resume.service.d.ts.map