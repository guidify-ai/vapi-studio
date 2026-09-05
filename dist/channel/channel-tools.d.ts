/**
 * Optional tool ads from the channel (e.g. Vapi Custom LLM `body.tools`).
 *
 * Convention: Vapi Studio requests tools **by name** assuming the Vapi assistant was
 * pre-provisioned with them. This snapshot is visibility for operators / soft
 * warnings — not a required inventory gate, and not shared sync state.
 */
export interface ChannelTool {
    name: string;
    description?: string;
    /** JSON Schema-ish parameters when present on the advertisement. */
    parameters?: Record<string, unknown>;
    /** Raw provider type when known (`function`, `handoff`, `endCall`, …). */
    type?: string;
}
export interface ChannelToolResult {
    /** Provider tool_call id when present. */
    toolCallId?: string;
    /** Function name when recoverable from prior assistant tool_calls. */
    name?: string;
    /** Raw content string from the tool message. */
    content: string;
    /** Best-effort JSON parse of content. */
    parsed?: unknown;
}
export interface ChannelToolsApi {
    list(): ChannelTool[];
    has(name: string): boolean;
    get(name: string): ChannelTool | undefined;
}
export interface VapiTurnContext {
    callId: string | null;
    assistantId?: string | null;
    phoneNumber?: string | null;
    customer?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    /** Model name from the Custom LLM request when provided. */
    model?: string | null;
}
/** Normalize Vapi/OpenAI tool advertisements into a flat list. */
export declare function extractAdvertisedTools(tools: unknown): ChannelTool[];
export declare function channelToolsApiFromList(tools: ChannelTool[]): ChannelToolsApi;
type ChatMessage = {
    role?: string;
    content?: unknown;
    tool_call_id?: string;
    name?: string;
    tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
            name?: string;
            arguments?: string;
        };
    }>;
};
/**
 * Collect `role:tool` messages from the newest Custom LLM request,
 * pairing names from prior assistant `tool_calls` when possible.
 */
export declare function extractToolResults(body: {
    messages?: ChatMessage[];
}): ChannelToolResult[];
/** Metadata keys stashed on SupervisedConversation.metadata each Custom LLM turn. */
export declare const CHANNEL_META: {
    readonly tools: "channelTools";
    readonly toolResults: "lastToolResults";
    readonly vapi: "vapi";
    readonly pendingToolNodeId: "pendingToolCallNodeId";
};
export {};
//# sourceMappingURL=channel-tools.d.ts.map