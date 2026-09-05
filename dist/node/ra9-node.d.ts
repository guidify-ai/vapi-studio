import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { ListenExpectation } from '../conversation/listen-expectation';
import type { ConversationHistory } from '../conversation/conversation-history';
import type { ConversationSchema, DefaultConversationSchema, SchemaMemory, SchemaVariables } from '../conversation/conversation-schema';
import type { ConversationOutput, NodeResult } from '../output/conversation-output';
import type { EventService } from '../events/event.service';
import type { IntegrationClient, IntegrationRequest, IntegrationResponse } from '../integrations/integration-client';
import type { BrainService } from '../brain/brain.port';
import type { BrainClarifyRequest, BrainClarifyResult } from '../brain/brain-clarify';
import type { BrainJudgeRequest, BrainJudgeResult } from '../brain/brain-judge';
import type { CatchDirective } from './catch-directive';
import type { FormsService } from '../forms/forms.service';
import type { FormExposeHandle, FormExposeSpec, FormValues } from '../forms/form.types';
import { type ChannelToolResult, type ChannelToolsApi, type VapiTurnContext } from '../channel/channel-tools';
/**
 * Typed view of the Conversation for Nodes.
 * Inner types come from the app ConversationSchema generic.
 */
export interface ConversationView<TSchema extends ConversationSchema = DefaultConversationSchema> {
    id: string;
    providerCallId: string;
    flowId: string;
    variables: SchemaVariables<TSchema>;
    memory: SchemaMemory<TSchema>;
}
/**
 * Node execution context — fully schema-aware.
 * `ctx.memory.foo` and `ctx.conversation.variables.bar` are typed from TSchema.
 */
export interface NodeContext<TSchema extends ConversationSchema = DefaultConversationSchema> {
    runtime: SupervisedConversation;
    conversation: ConversationView<TSchema>;
    userText: string;
    output: ConversationOutput;
    events: EventService;
    /** Same object as `conversation.memory`, typed. */
    memory: SchemaMemory<TSchema>;
    /**
     * Intention currently being considered for transfer (set during before()/run()).
     */
    intention: string | null;
    /**
     * Compact chat + node path from before this candidate is entered.
     * Use for iteration counts / "were we just in X?".
     */
    history: ConversationHistory;
    /** How many times `nodeId` has already been entered this call. */
    visitCount: (nodeId: string) => number;
    /** Last entered node id, or null at the start. */
    previousNodeId: string | null;
    /**
     * Ask Brain a clarification question with a required object answer shape.
     * Always resolves to `{ answer: object }`.
     */
    clarify: <TAnswer extends Record<string, unknown> = Record<string, unknown>>(request: BrainClarifyRequest) => Promise<BrainClarifyResult<TAnswer>>;
    /**
     * LLM-as-a-judge: pass/fail + reasoning + confidence for evals (rarely live).
     */
    judge: <TContext = unknown>(request: BrainJudgeRequest<TContext>) => Promise<BrainJudgeResult>;
    /**
     * Signed outbound HTTP (JWT HMAC in x-signature). Conversation ids filled in.
     */
    integrations: {
        request: <T = unknown>(input: Omit<IntegrationRequest, 'meta'> & {
            meta?: IntegrationRequest['meta'];
        }) => Promise<IntegrationResponse<T>>;
    };
    /**
     * Blocking form expose (Studio modal / Formsster). Requires a dispose adapter.
     * Live Vapi should use `open` so the Custom LLM turn can finish (TTS) before fillout.
     * `hasPending` is true while an expose awaits submit (silence/ghosting must not end).
     */
    forms: {
        expose: (spec: FormExposeSpec) => Promise<FormValues>;
        /** Deliver + speak wait copy, return without blocking the channel turn. */
        open: (spec: FormExposeSpec) => Promise<FormExposeHandle>;
        /** Re-dispose the open expose (caller never got the SMS / link). */
        resend: () => Promise<FormExposeHandle | null>;
        /** Take submitted values after {@link open} (clears the expose). */
        claimSubmitted: () => FormValues | null;
        hasPending: () => boolean;
        hasUnclaimedSubmit: () => boolean;
    };
    /**
     * Tools advertised on this channel turn (Vapi Custom LLM `body.tools`).
     * Empty in Studio unless the app stashes a snapshot.
     */
    tools: ChannelToolsApi;
    /** Tool results from this Custom LLM request (`role:tool` messages). */
    toolResults: () => ChannelToolResult[];
    /** Lookup by tool name or tool_call id. */
    toolResult: (nameOrId: string) => ChannelToolResult | undefined;
    /**
     * Vapi call/turn metadata for this request (null fields when not delivered).
     */
    vapi: VapiTurnContext;
}
/**
 * Node lifecycle (per turn selection) — declare overrides in this order:
 *   before()  → authorize / prepare (return false to reject)
 *   listen()  → register listen expectation before speech
 *   run()     → execute
 *   after()   → teardown for this Node execution
 *   catch()   → recover from FlowUncertainError / other errors
 */
export declare abstract class Ra9Node<TSchema extends ConversationSchema = DefaultConversationSchema> {
    /**
     * Seconds the channel waits after a user pause before closing this Node's
     * listen. Override on the subclass. `listen()` / `sayAndListen({ timeoutSeconds })`
     * can still override per turn.
     */
    listenTimeoutSeconds: number;
    /**
     * When false, the next listen is not barge-in: Custom LLM overlap is queued
     * until `listenTimeoutSeconds` of silence after the last fragment.
     */
    interruptible: boolean;
    before(_ctx: NodeContext<TSchema>): Promise<boolean>;
    listen(_ctx: NodeContext<TSchema>): Promise<ListenExpectation | null>;
    abstract run(ctx: NodeContext<TSchema>): Promise<NodeResult>;
    after(_ctx: NodeContext<TSchema>, _result: NodeResult): Promise<void>;
    /**
     * Handle errors thrown from run() (e.g. FlowUncertainError).
     * Return restartNode() / forceIntention(...) / catchResult(...) / rethrowCatch().
     * Default: rethrow.
     */
    catch(_ctx: NodeContext<TSchema>, _error: unknown): Promise<CatchDirective>;
}
export declare const RA9_NODE_REGISTRY: unique symbol;
/** Runtime registry is schema-erased; Nodes keep compile-time schema via their class generic. */
export type Ra9NodeRegistry = Map<string, Ra9Node<any>>;
export declare function conversationViewFromRuntime<TSchema extends ConversationSchema = DefaultConversationSchema>(runtime: SupervisedConversation): ConversationView<TSchema>;
export declare function nodeContextFromRuntime<TSchema extends ConversationSchema = DefaultConversationSchema>(input: {
    runtime: SupervisedConversation;
    userText: string;
    output: ConversationOutput;
    events: EventService;
    brain: BrainService;
    integrations?: IntegrationClient;
    forms?: FormsService;
    intention?: string | null;
}): NodeContext<TSchema>;
//# sourceMappingURL=ra9-node.d.ts.map