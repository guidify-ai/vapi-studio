import type { ListenExtractField, ListenExtractSpec, SayAndListenOptions } from '../conversation/listen-expectation';
export type OutputKind = 'say' | 'sayAndListen' | 'endCall' | 'transferToHuman' | 'handoff' | 'continueTo' | 'toolCall';
export interface ToolCallRequest {
    /** Advertised channel tool / function name (e.g. Vapi `model.tools[].function.name`). */
    name: string;
    arguments?: Record<string, unknown>;
}
export interface OutputAction {
    kind: OutputKind;
    text?: string;
    destination?: string;
    /**
     * Workflow module id to hand off to (e.g. `identity`, `farewell`).
     * Present when kind === 'handoff'. Compiles to Vapi Squad handoff.
     */
    handoffTo?: string;
    handoffReason?: string;
    handoffPayload?: Record<string, unknown>;
    /** Vapi assistantName resolved from workflow config (adapter may fill). */
    assistantName?: string;
    /**
     * Same-flow jump target node id (kind === 'continueTo').
     * Does not emit a Squad handoff — stays on the current assistant.
     */
    continueToNodeId?: string;
    /** Present when sayAndListen declared listen/extract for the next answer. */
    sayAndListen?: SayAndListenOptions;
    /** Present when kind === 'toolCall' — raw channel tool by advertised name. */
    toolCall?: ToolCallRequest;
}
export type NodeResult = OutputAction;
export interface ConversationOutput {
    say(text: string): Promise<void>;
    sayAndListen(text: string, options?: SayAndListenOptions): Promise<NodeResult>;
    endCall(text?: string): Promise<NodeResult>;
    transferToHuman(destination?: string): Promise<NodeResult>;
    /**
     * Leave this module without ending the Conversation.
     * Compiles to Vapi Squad handoff (or Studio in-process module switch).
     * Prefer `continueTo` when staying on a single assistant.
     */
    handoff(input: {
        to: string;
        reason?: string;
        payload?: Record<string, unknown>;
        text?: string;
    }): Promise<NodeResult>;
    /**
     * Jump to another Node in the **same** loaded flow and speak its entry
     * on the next turn (Studio / same-assistant Vapi). Does not emit Squad handoff.
     */
    continueTo(input: {
        nodeId: string;
        reason?: string;
        text?: string;
    }): Promise<NodeResult>;
    /**
     * Request a **channel tool by the function name Vapi advertised** on this
     * assistant (`model.tools[].function.name`). Compiles to OpenAI-compatible
     * `tool_calls` SSE — same framing as `endCall` / `transferToHuman` / `handoff`.
     *
     * Prefer semantic helpers when they apply. This is for app-specific tools
     * (SMS, CRM lookup, still-there hook, …) that you pre-provision on the assistant.
     */
    invokeAdvertisedTool(input: {
        name: string;
        arguments?: Record<string, unknown>;
        /** Optional speech before the tool call is emitted. */
        text?: string;
    }): Promise<NodeResult>;
    /**
     * @deprecated Use {@link invokeAdvertisedTool}. Kept for older app code.
     */
    toolCall(input: {
        name: string;
        arguments?: Record<string, unknown>;
        text?: string;
    }): Promise<NodeResult>;
    readonly actions: OutputAction[];
}
export declare class BufferedConversationOutput implements ConversationOutput {
    readonly actions: OutputAction[];
    private readonly onSay?;
    constructor(onSay?: (text: string) => Promise<void>);
    say(text: string): Promise<void>;
    sayAndListen(text: string, options?: SayAndListenOptions): Promise<NodeResult>;
    endCall(text?: string): Promise<NodeResult>;
    transferToHuman(destination?: string): Promise<NodeResult>;
    handoff(input: {
        to: string;
        reason?: string;
        payload?: Record<string, unknown>;
        text?: string;
    }): Promise<NodeResult>;
    continueTo(input: {
        nodeId: string;
        reason?: string;
        text?: string;
    }): Promise<NodeResult>;
    invokeAdvertisedTool(input: {
        name: string;
        arguments?: Record<string, unknown>;
        text?: string;
    }): Promise<NodeResult>;
    toolCall(input: {
        name: string;
        arguments?: Record<string, unknown>;
        text?: string;
    }): Promise<NodeResult>;
}
/** Re-export for callers that import extract types via output. */
export type { ListenExtractField, ListenExtractSpec, SayAndListenOptions };
//# sourceMappingURL=conversation-output.d.ts.map