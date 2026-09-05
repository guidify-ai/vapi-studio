"use strict";
/**
 * Per-call Custom LLM turn queue.
 *
 * While a node turn is working (listen→run→after), late user utterances are
 * buffered. Once the turn finishes (listening again), queued speech is drained
 * as one combined prompt — a series of user talk, not N racing turns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallTurnQueueRegistry = exports.CallTurnQueue = void 0;
exports.coalesceUserUtterances = coalesceUserUtterances;
function coalesceUserUtterances(utterances) {
    const cleaned = [];
    for (const raw of utterances) {
        const text = raw.trim().replace(/\s+/g, ' ');
        if (!text)
            continue;
        const prev = cleaned[cleaned.length - 1];
        if (prev &&
            (prev === text || prev.includes(text) || text.includes(prev))) {
            // Prefer the longer near-duplicate.
            if (text.length > prev.length)
                cleaned[cleaned.length - 1] = text;
            continue;
        }
        cleaned.push(text);
    }
    if (cleaned.length === 0)
        return '';
    if (cleaned.length === 1)
        return cleaned[0];
    return [
        'The user spoke several times in quick succession (overlapping speech / barge-in).',
        'Treat the following series as one combined user answer — not separate turns:',
        ...cleaned.map((text, i) => `${i + 1}) ${text}`),
    ].join('\n');
}
class CallTurnQueue {
    working = false;
    pending = [];
    /** Mutex chain — only one exclusive section runs at a time. */
    tail = Promise.resolve();
    get isWorking() {
        return this.working;
    }
    get pendingCount() {
        return this.pending.length;
    }
    /**
     * Buffer user speech.
     * Empty string is allowed once — Vapi "assistant speaks first" Custom LLM
     * requests arrive with no user text and must still run the opening node.
     */
    enqueue(userText) {
        const text = userText.trim();
        const last = this.pending[this.pending.length - 1];
        if (last === text)
            return;
        // At most one empty opening token waiting in the queue.
        if (!text && this.pending.some((p) => p === ''))
            return;
        this.pending.push(text);
    }
    drain() {
        return this.pending.splice(0, this.pending.length);
    }
    /**
     * Enqueue this request's user text, wait if another turn is working, then
     * run `work` with the coalesced pending series (or skip if already drained).
     *
     * After `work` returns, further pending utterances run on this same call
     * only when `continueDraining()` is true. Vapi Custom LLM must leave them
     * for the waiting HTTP request — that is the stream the provider plays.
     */
    async runExclusive(input) {
        this.enqueue(input.userText);
        let release;
        const mySlot = new Promise((resolve) => {
            release = resolve;
        });
        const previous = this.tail;
        this.tail = this.tail.then(() => mySlot);
        await previous;
        if (this.pending.length === 0) {
            release();
            return { status: 'skipped' };
        }
        this.working = true;
        let lastResult;
        try {
            const holdMs = input.listenHoldMs ?? 0;
            if (holdMs > 0 && this.pending.some((p) => p.trim().length > 0)) {
                await this.holdForMoreUtterances(holdMs);
            }
            do {
                const parts = this.drain();
                if (!parts.length)
                    break;
                const combined = coalesceUserUtterances(parts);
                const nonEmptyParts = parts.map((p) => p.trim()).filter(Boolean);
                // Empty combined is valid for speak-first opening (parts === ['']).
                const openingOnly = nonEmptyParts.length === 0;
                if (!combined && !openingOnly)
                    break;
                lastResult = await input.work(combined, {
                    parts: openingOnly ? [''] : nonEmptyParts.length ? nonEmptyParts : parts,
                    series: nonEmptyParts.length > 1,
                });
            } while (this.pending.length > 0 &&
                (input.continueDraining?.() ?? false));
            return { status: 'ran', result: lastResult };
        }
        finally {
            this.working = false;
            release();
        }
    }
    /**
     * Debounce: wait until `holdMs` of silence after the last queued utterance,
     * capped at 2× holdMs from when the hold started.
     */
    async holdForMoreUtterances(holdMs) {
        const started = Date.now();
        const maxMs = holdMs * 2;
        let lastCount = this.pending.length;
        let lastChange = Date.now();
        while (Date.now() - started < maxMs) {
            if (Date.now() - lastChange >= holdMs) {
                return;
            }
            await new Promise((r) => setTimeout(r, 25));
            if (this.pending.length !== lastCount) {
                lastCount = this.pending.length;
                lastChange = Date.now();
            }
        }
    }
}
exports.CallTurnQueue = CallTurnQueue;
/** Process-local queues keyed by provider call id. */
class CallTurnQueueRegistry {
    queues = new Map();
    get(providerCallId) {
        let q = this.queues.get(providerCallId);
        if (!q) {
            q = new CallTurnQueue();
            this.queues.set(providerCallId, q);
        }
        return q;
    }
    delete(providerCallId) {
        this.queues.delete(providerCallId);
    }
}
exports.CallTurnQueueRegistry = CallTurnQueueRegistry;
//# sourceMappingURL=call-turn-queue.js.map