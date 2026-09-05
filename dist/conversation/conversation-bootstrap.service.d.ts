import { SupervisedConversation } from './supervised-conversation';
import { SupervisedConversationRegistry } from './supervised-conversation.registry';
import { CallTurnQueueRegistry } from './call-turn-queue';
import { ConversationRepository } from '../persistence/conversation.repository';
import { EventService } from '../events/event.service';
import { BrainUsageTracker } from '../brain/brain-usage.tracker';
import { FlowLoader } from '../flow/flow-loader';
import { type ConversationEntryPoint } from './conversation-entry';
export declare class ConversationBootstrapService {
    private readonly conversations;
    private readonly registry;
    private readonly flowLoader;
    private readonly events;
    private readonly turnQueues;
    private readonly brainUsage;
    private readonly entry;
    /** Serialize concurrent bootstrap for the same Vapi call (assistant.started ∥ Custom LLM). */
    private readonly bootstrapping;
    constructor(conversations: ConversationRepository, registry: SupervisedConversationRegistry, flowLoader: FlowLoader, events: EventService, turnQueues: CallTurnQueueRegistry, brainUsage: BrainUsageTracker, entryPoint?: ConversationEntryPoint);
    bootstrap(input: {
        projectId: string;
        providerCallId: string;
        brainProfileId: string;
        metadata?: Record<string, unknown>;
        variables?: Record<string, unknown>;
    }): Promise<SupervisedConversation>;
    private bootstrapExclusive;
    private openCallLog;
    finalizeEnded(providerCallId: string): Promise<void>;
    /** Persist live runtime so a process crash can restore ACTIVE conversations. */
    checkpoint(runtime: SupervisedConversation): Promise<void>;
    /**
     * Simulate process memory loss: drop all in-memory runtimes without ending DB rows.
     * Checkpoints already in Postgres remain ACTIVE for restore.
     */
    simulateCrash(): {
        dropped: number;
        providerCallIds: string[];
    };
    /** Reload every ACTIVE conversation that has a runtime_state checkpoint. */
    restoreAllActive(): Promise<{
        restored: number;
        skipped: number;
        conversationIds: string[];
    }>;
    disasterStatus(): Promise<{
        memoryCount: number;
        dbActiveCount: number;
        dbCheckpointCount: number;
        memory: Array<{
            conversationId: string;
            providerCallId: string;
            currentNodeId: string | null;
            turnNumber: number;
        }>;
    }>;
    /** Registry has no public iterator — poke via provider ids we track on restore/bootstrap. */
    private listRegistryRuntimes;
}
//# sourceMappingURL=conversation-bootstrap.service.d.ts.map