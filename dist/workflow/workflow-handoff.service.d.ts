import { FlowLoader } from '../flow/flow-loader';
import { EventService } from '../events/event.service';
import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { OutputAction } from '../output/conversation-output';
import { WorkflowLoader } from './workflow-loader';
import { ConversationBootstrapService } from '../conversation/conversation-bootstrap.service';
/**
 * Applies workflow module handoffs and same-flow `continueTo` jumps on a
 * shared Conversation runtime. Does not end the Conversation.
 */
export declare class WorkflowHandoffService {
    private readonly workflows;
    private readonly flows;
    private readonly events;
    private readonly bootstrap;
    constructor(workflows: WorkflowLoader, flows: FlowLoader, events: EventService, bootstrap: ConversationBootstrapService);
    configDir(): string;
    /**
     * Enrich handoff actions with Vapi assistantName; apply in-memory module
     * switches and same-flow continueTo jumps. Returns the (possibly enriched) actions.
     */
    applyHandoffs(runtime: SupervisedConversation, actions: OutputAction[]): Promise<OutputAction[]>;
    private applyContinueTo;
    /** Load entry module flow for a new Conversation. */
    activateEntryModule(runtime: SupervisedConversation): void;
    /** Ensure the flow for the runtime's active module is loaded. */
    ensureActiveFlow(runtime: SupervisedConversation): void;
}
//# sourceMappingURL=workflow-handoff.service.d.ts.map