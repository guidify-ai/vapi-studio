/**
 * Per-call Custom LLM turn queue.
 *
 * While a node turn is working (listen→run→after), late user utterances are
 * buffered. Once the turn finishes (listening again), queued speech is drained
 * as one combined prompt — a series of user talk, not N racing turns.
 */
export declare function coalesceUserUtterances(utterances: string[]): string;
export type TurnQueueWorkMeta = {
    /** Raw utterance parts that were coalesced (after near-dup folding). */
    parts: string[];
    /** True when more than one distinct utterance was merged. */
    series: boolean;
};
export declare class CallTurnQueue {
    private working;
    private readonly pending;
    /** Mutex chain — only one exclusive section runs at a time. */
    private tail;
    get isWorking(): boolean;
    get pendingCount(): number;
    /**
     * Buffer user speech.
     * Empty string is allowed once — Vapi "assistant speaks first" Custom LLM
     * requests arrive with no user text and must still run the opening node.
     */
    enqueue(userText: string): void;
    private drain;
    /**
     * Enqueue this request's user text, wait if another turn is working, then
     * run `work` with the coalesced pending series (or skip if already drained).
     *
     * After `work` returns, further pending utterances run on this same call
     * only when `continueDraining()` is true. Vapi Custom LLM must leave them
     * for the waiting HTTP request — that is the stream the provider plays.
     */
    runExclusive<T>(input: {
        userText: string;
        continueDraining?: () => boolean;
        /**
         * After the last queued utterance, wait this many ms for more ASR fragments
         * before running work. 0 / omitted = no hold (opening turn, tests).
         */
        listenHoldMs?: number;
        work: (combinedUserText: string, meta: TurnQueueWorkMeta) => Promise<T>;
    }): Promise<{
        status: 'ran';
        result: T;
    } | {
        status: 'skipped';
    }>;
    /**
     * Debounce: wait until `holdMs` of silence after the last queued utterance,
     * capped at 2× holdMs from when the hold started.
     */
    private holdForMoreUtterances;
}
/** Process-local queues keyed by provider call id. */
export declare class CallTurnQueueRegistry {
    private readonly queues;
    get(providerCallId: string): CallTurnQueue;
    delete(providerCallId: string): void;
}
//# sourceMappingURL=call-turn-queue.d.ts.map