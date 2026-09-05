/**
 * Brain judge — LLM-as-a-judge.
 * Rare on the live call path; the primary consumer is eval tests.
 *
 * Given stringifiable context + a plain-language goal + success/failure
 * criteria, adapters return pass/fail, reasoning bullets, and confidence.
 */
/** Default: no confidence floor — callers opt in via options.confidenceThreshold. */
export declare const DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD = 0;
/** Confidence as a fixed 6-decimal string, e.g. "0.850000". Always matches /^\d\.\d{6}$/. */
export declare const CONFIDENCE_6_PATTERN: RegExp;
export type Confidence6 = string;
export interface BrainJudgeOptions {
    /**
     * 0..1. Does not change `passed` (that is the model judgment).
     * Sets `belowThreshold` when formatted confidence is below this floor.
     * Trusted pass = `passed && !belowThreshold`.
     */
    confidenceThreshold?: number;
    /**
     * OpenAI model id for this call (studio-chatgpt cheap whitelist).
     * Ignored by mock. Falls back to VapiStudioModule brain.model.
     */
    model?: string;
}
export interface BrainJudgeRequest<TContext = unknown> {
    /** Transcript, memory snapshot, or any JSON-serializable eval fixture. */
    context: TContext;
    /** What “good” means, in plain language. */
    goals: string;
    /** Criteria that must hold for a pass. */
    successConditions: string[];
    /** Criteria that force a fail if observed. */
    failureConditions: string[];
    options?: BrainJudgeOptions;
    /** Optional correlation for usage / console (filled by NodeContext). */
    meta?: {
        providerCallId?: string;
        conversationId?: string;
    };
}
export interface BrainJudgeResult {
    /** Model pass/fail. Threshold is not mixed in; see `belowThreshold`. */
    passed: boolean;
    /** Short reasons for why it passed or failed. */
    reasoning: string[];
    /** Certainty in [0,1], always 6 decimal places: "0.850000". */
    confidence: Confidence6;
    /** True when confidence is below options.confidenceThreshold. */
    belowThreshold: boolean;
}
export declare function resolveJudgeConfidenceThreshold(value: number | undefined): number;
export declare function clampConfidence(value: unknown): number;
/** Clamp to [0, 1] and format as `\d.\d\d\d\d\d\d`. */
export declare function formatConfidence6(value: unknown): Confidence6;
export declare function isConfidence6(value: string): value is Confidence6;
export declare function normalizeReasoning(raw: unknown): string[];
/**
 * JSON-stringify objects; pass strings through.
 * Prefer this over clarifiableInputToString so `{foo:1}` is not `[object Object]`.
 */
export declare function judgeContextToString(context: unknown): string;
/**
 * Normalize raw Brain JSON into a judge result.
 * `passed` is the model judgment; threshold only sets `belowThreshold`.
 */
export declare function normalizeJudgeResult(raw: unknown, options?: BrainJudgeOptions): BrainJudgeResult;
//# sourceMappingURL=brain-judge.d.ts.map