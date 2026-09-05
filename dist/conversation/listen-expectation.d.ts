/**
 * Listen registration — opened before Node speech so interrupts still bind to it.
 * Guides Brain intention scan + optional field extraction + ASR/LLM hints.
 */
export interface ListenIntentionBoost {
    /** Intention name to prioritize (e.g. isAcknowledge, studio.isGoodbye). */
    name: string;
    /**
     * Extra weight for Brain scoring (hint only — does not change Supervisor walk order).
     * Higher = more preferred by the scanner. Default when listed: 10.
     */
    boost?: number;
    /**
     * Supervisor walk order among scored intentions. Higher is tried first.
     * Default 1. Tie-break: intention name A–Z.
     */
    priority?: number;
}
/**
 * Field the Brain should pull from the next user utterance.
 * App writes memory itself via `onExtracted` — no framework auto-target.
 */
export interface ListenExtractField {
    /** Key in Brain JSON `extracted` object (e.g. "firstName"). */
    key: string;
    /** Helps LLM extraction. */
    description?: string;
    type?: 'string' | 'number' | 'boolean';
    /** If true and missing, extraction is incomplete (logged; routing still proceeds). */
    required?: boolean;
}
/** Context passed to the sayAndListen extract callback. */
export interface ListenExtractApplyContext {
    memory: Record<string, unknown>;
    variables: Record<string, unknown>;
    userText: string;
}
/**
 * App-owned handler: Brain returns `extracted`, you set memory/variables yourself.
 */
export type ListenExtractHandler = (extracted: Record<string, unknown>, ctx: ListenExtractApplyContext) => void | Promise<void>;
/** Closed-set cheap match before Brain (listed options: pick N / neither). */
export type ListenResolveIntention = (input: {
    userText: string;
    memory: Record<string, unknown>;
}) => string | null | Promise<string | null>;
/**
 * Extract registration for the next answer:
 * - `fields` tell Brain what to pull
 * - `onExtracted` lets the Node write memory (required for applying values)
 */
export interface ListenExtractSpec {
    fields: ListenExtractField[];
    onExtracted?: ListenExtractHandler;
}
export interface ListenExpectation {
    /** Intentions this Node expects / wants Brain to prioritize. */
    intentions: ListenIntentionBoost[];
    /**
     * Hints for Brain/ops: what the user might mean if ASR is messy.
     * Valuable context for LLM intention scanning.
     */
    hints?: string[];
    /** Optional free-form operator note. */
    note?: string;
    /** Structured extraction for the next user answer (fields + apply callback). */
    extract?: ListenExtractSpec;
    /**
     * Seconds the channel waits after a user pause before closing this listen.
     * Omit to use the Node class `listenTimeoutSeconds` (framework default 2.5).
     */
    timeoutSeconds?: number;
    /**
     * When false, overlapping Custom LLM POSTs are queued until this listen's
     * timeout of silence after the last fragment. Default true (barge-in).
     */
    interruptible?: boolean;
    /**
     * Cheap closed-set match **before** Brain scan. If this returns an intention
     * name that is on this listen, Supervisor skips OpenAI and walks that
     * intention at confidence 1. Return null to fall through to Brain (portals,
     * unknown, free-form). Use after the bot listed numbered options.
     */
    resolveIntention?: ListenResolveIntention;
}
/** Options passed to `sayAndListen` — especially extraction for the next answer. */
export interface SayAndListenOptions {
    /**
     * Ask Brain for fields, then run `onExtracted` so the Node sets memory itself.
     *
     * @example
     * sayAndListen("What's your first name?", {
     *   extract: {
     *     fields: [{ key: 'firstName', type: 'string', required: true }],
     *     onExtracted: (data) => { ctx.memory.callerName = String(data.firstName ?? ''); },
     *   },
     * })
     */
    extract?: ListenExtractSpec;
    /** If set, replaces listen intentions for the next turn. */
    intentions?: ListenIntentionBoost[];
    hints?: string[];
    note?: string;
    /** Per-turn listen window; wins over `listen()` and the Node class default. */
    timeoutSeconds?: number;
    /** Per-turn barge-in; wins over Node class `interruptible`. */
    interruptible?: boolean;
    /** Per-turn closed-set matcher; wins over `listen()`. */
    resolveIntention?: ListenResolveIntention;
}
export declare function applyListenBoosts(candidates: Array<{
    name: string;
    rank: number;
    payload?: unknown;
}>, listen: ListenExpectation | null | undefined): Array<{
    name: string;
    rank: number;
    payload?: unknown;
}>;
/**
 * Merge `sayAndListen` options into the listen registered by `node.listen()`.
 * Extract spec on sayAndListen wins for the upcoming user answer.
 */
export declare function mergeSayAndListenOptions(current: ListenExpectation | null | undefined, options: SayAndListenOptions | undefined): ListenExpectation | null;
/**
 * Run a listen's cheap matcher. Returns an intention name only when it is
 * listed on this listen. Null → Brain scan as usual.
 */
export declare function tryResolveListenIntention(input: {
    listen: ListenExpectation | null | undefined;
    userText: string;
    memory: Record<string, unknown>;
}): Promise<string | null>;
export declare function missingRequiredExtractKeys(fields: ListenExtractField[] | undefined, extracted: Record<string, unknown> | undefined): string[];
/**
 * Pull a plausible person name from ASR text.
 * Accepts "Mark." / "yeah Mark" from voice ASR. Rejects pronouns and
 * intent sentences (e.g. "I need my roof estimate").
 */
export declare function mockExtractPersonName(userText: string, prefer?: 'first' | 'last'): string | undefined;
/**
 * Deterministic mock extraction for tests / MockBrain (no LLM).
 */
export declare function mockExtractFromUserText(userText: string, fields: ListenExtractField[] | undefined): Record<string, unknown>;
//# sourceMappingURL=listen-expectation.d.ts.map