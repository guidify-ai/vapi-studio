import type { OutputAction } from '../../output/conversation-output';
export interface VapiStreamWriter {
    write(chunk: string): void;
    end(): void;
}
export type VapiToolLike = {
    type?: string;
    function?: {
        name?: string;
    };
    name?: string;
} | Record<string, unknown>;
export declare function extractToolFunctionNames(tools: unknown): string[];
export declare function resolveEndCallToolName(tools?: unknown): string;
export declare function resolveTransferCallToolName(tools?: unknown): string;
export declare function resolveHandoffToolName(tools?: unknown, assistantName?: string): string;
/**
 * Vapi Squad handoff tool-call arguments.
 * `destination` MUST be a string (assistantName / assistantId enum value) —
 * not an object. See https://docs.vapi.ai/squads/handoff
 */
export declare function buildVapiHandoffToolArgs(input: {
    assistantName: string;
    reason?: string;
    payload?: Record<string, unknown>;
}): Record<string, unknown>;
/** True when the Custom LLM request advertises at least one handoff tool. */
export declare function hasAdvertisedHandoffTool(tools?: unknown): boolean;
/**
 * Compiles Vapi Studio output actions into OpenAI-compatible SSE for Vapi Custom LLM.
 */
export declare class VapiSseCompiler {
    private readonly model;
    private readonly id;
    private readonly tools;
    constructor(opts?: {
        model?: string;
        id?: string;
        tools?: unknown;
    });
    /** Replay prior assistant utterances onto this SSE (coalesced waiter). */
    replayAssistantSpeech(writer: VapiStreamWriter, texts: string[]): void;
    writeAssistantText(writer: VapiStreamWriter, text: string): void;
    writeToolCall(writer: VapiStreamWriter, name: string, args: Record<string, unknown>, index?: number): void;
    /** Close stream after normal speech (no tool call). */
    finish(writer: VapiStreamWriter): void;
    /** Close stream after a tool call — do not emit finish_reason=stop. */
    finishAfterToolCalls(writer: VapiStreamWriter): void;
    streamTerminalActions(writer: VapiStreamWriter, actions: OutputAction[]): Promise<{
        emittedTools: string[];
    }>;
}
export declare function extractNewestUserText(body: {
    messages?: Array<{
        role?: string;
        content?: unknown;
    }>;
}): string;
export declare function extractVapiCallId(body: Record<string, unknown>): string | null;
export declare function extractVapiCallerNumber(body: Record<string, unknown> | null | undefined): string | null;
//# sourceMappingURL=vapi-sse.compiler.d.ts.map