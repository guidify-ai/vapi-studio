export type BrainCallKind = 'scan' | 'clarify' | 'judge';
export interface BrainUsageRecord {
    kind: BrainCallKind;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedUsd: number;
    at: string;
}
export interface BrainUsageSummary {
    providerCallId: string;
    conversationId?: string;
    calls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    /** Approximate USD from whitelist pricing table. */
    estimatedUsd: number;
    byModel: Record<string, {
        calls: number;
        promptTokens: number;
        completionTokens: number;
        estimatedUsd: number;
    }>;
    records: BrainUsageRecord[];
}
/**
 * Per-call LLM usage ledger for stock Brain adapters (ChatGPT / Claude / Gemini / Grok).
 * Printed as $$$ at end of call (finalize).
 */
export declare class BrainUsageTracker {
    private readonly byCall;
    beginCall(providerCallId: string, conversationId?: string): void;
    record(input: {
        providerCallId: string;
        conversationId?: string;
        kind: BrainCallKind;
        model: string;
        promptTokens: number;
        completionTokens: number;
    }): BrainUsageRecord;
    summary(providerCallId: string): BrainUsageSummary | null;
    /** Format a short money line for console / logs. */
    formatMoney(usd: number): string;
    clear(providerCallId: string): void;
}
//# sourceMappingURL=brain-usage.tracker.d.ts.map