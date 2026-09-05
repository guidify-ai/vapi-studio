/**
 * Brain clarify — ask a free-form question with a required object answer shape.
 * Used when the flow has an ambiguous / incomplete answer and needs a Brain judgment.
 *
 * Reserved failure: throws ClarifyCannotAnswerError (`studio.clarify.cannotAnswer`).
 */
/** Anything the runtime can stringify for Brain context. */
export type ClarifiableInput = string | number | boolean | bigint | Date | null | undefined | {
    toString(): string;
};
export interface BrainAnswerField {
    key: string;
    description?: string;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
}
/**
 * Declares the object interface Brain must return.
 * On success, `answer` is always an object keyed by these fields.
 */
export interface BrainAnswerInterface {
    fields: BrainAnswerField[];
    /** Optional overall description of the answer object. */
    description?: string;
}
export interface BrainClarifyRequest {
    /** Arbitrary context convertible to string (user text, extracted blob, JSON, …). */
    input: ClarifiableInput;
    /** Question posed to Brain. */
    question: string;
    /** Required object answer shape. */
    answer: BrainAnswerInterface;
    /** Optional correlation for usage / console (filled by NodeContext). */
    meta?: {
        providerCallId?: string;
        conversationId?: string;
    };
}
/** Reserved clarify exception code — Brain cannot produce a reliable answer. */
export declare const STUDIO_CLARIFY_CANNOT_ANSWER: "studio.clarify.cannotAnswer";
/**
 * Reserved exception thrown by Brain.clarify when it cannot answer.
 * Catch this in Node.run / Node.catch to recover (restartNode, forceIntention, …).
 */
export declare class ClarifyCannotAnswerError extends Error {
    readonly code: "studio.clarify.cannotAnswer";
    readonly reason?: string;
    readonly details?: Record<string, unknown>;
    constructor(reason?: string, details?: Record<string, unknown>);
}
export declare function isClarifyCannotAnswerError(error: unknown): error is ClarifyCannotAnswerError;
/** Throw the reserved cannot-answer exception. */
export declare function throwClarifyCannotAnswer(reason?: string, details?: Record<string, unknown>): never;
/**
 * Successful clarify result — always an object answer.
 * Failure is never returned here; adapters throw ClarifyCannotAnswerError.
 */
export interface BrainClarifyResult<TAnswer extends Record<string, unknown> = Record<string, unknown>> {
    answer: TAnswer;
}
/**
 * Normalize raw Brain JSON into a successful clarify result,
 * or throw ClarifyCannotAnswerError (reserved).
 *
 * Accepts:
 * - `{ outcome: "studio.clarify.cannotAnswer", reason? }` → throw
 * - `{ cannotAnswer: true, reason? }` → throw
 * - `{ answer: {...} }` / `{ outcome: "answered", answer: {...} }`
 */
export declare function normalizeClarifyResult<TAnswer extends Record<string, unknown> = Record<string, unknown>>(raw: unknown, answerInterface: BrainAnswerInterface): BrainClarifyResult<TAnswer>;
export declare function clarifiableInputToString(input: ClarifiableInput): string;
export declare function emptyAnswerFromInterface(answer: BrainAnswerInterface): Record<string, unknown>;
/** Keep only keys declared on the answer interface; sanitize string values fail-closed. */
export declare function filterClarifyAnswer(raw: Record<string, unknown> | null | undefined, answer: BrainAnswerInterface): Record<string, unknown>;
//# sourceMappingURL=brain-clarify.d.ts.map