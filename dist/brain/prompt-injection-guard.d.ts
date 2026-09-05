/**
 * Prompt-injection guardrails for Brain adapters.
 *
 * User speech (ASR) is untrusted data. Brain must classify/extract only —
 * never follow embedded instructions or produce free-form answers to callers.
 */
/** Max length for a single extracted string field (prevents essay / recipe dumps). */
export declare const MAX_EXTRACTED_STRING_LENGTH = 256;
/** Patterns that strongly suggest instruction injection, not conversational speech. */
export declare const PROMPT_INJECTION_PATTERNS: RegExp[];
/**
 * System-prompt lines appended to every Brain call that sees caller text.
 * Keep in sync with docs/best-practices/brain-and-prompt-injection.md.
 */
export declare function brainUntrustedInputRules(scope: 'scan' | 'clarify' | 'judge'): string[];
export declare function looksLikePromptInjection(text: string): boolean;
/**
 * True when the utterance (or any coalesced series part) looks like injection.
 * Used for fail-closed Brain paths before any provider round-trip.
 */
export declare function utteranceLooksLikePromptInjection(userText: string, seriesParts?: string[]): boolean;
/**
 * Drop or trim extracted values that look like injection or generative dumps.
 * Fail closed: return undefined to omit the key from extracted payload.
 */
export declare function sanitizeExtractedFieldValue(value: unknown, opts?: {
    maxLength?: number;
}): string | undefined;
/** Wrap caller text for the user role JSON payload (delimiter discipline). */
export declare function wrapUntrustedUserText(userText: string): {
    untrustedCallerText: string;
    note: string;
};
//# sourceMappingURL=prompt-injection-guard.d.ts.map