/**
 * Per-call Custom LLM turn queue.
 *
 * While a node turn is working (listen→run→after), late user utterances are
 * buffered. Once the turn finishes (listening again), queued speech is drained
 * as one combined prompt — a series of user talk, not N racing turns.
 */

export function coalesceUserUtterances(utterances: string[]): string {
  const cleaned: string[] = [];
  for (const raw of utterances) {
    const text = raw.trim().replace(/\s+/g, ' ');
    if (!text) continue;
    const prev = cleaned[cleaned.length - 1];
    if (
      prev &&
      (prev === text || prev.includes(text) || text.includes(prev))
    ) {
      // Prefer the longer near-duplicate.
      if (text.length > prev.length) cleaned[cleaned.length - 1] = text;
      continue;
    }
    cleaned.push(text);
  }

  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];

  return [
    'The user spoke several times in quick succession (overlapping speech / barge-in).',
    'Treat the following series as one combined user answer — not separate turns:',
    ...cleaned.map((text, i) => `${i + 1}) ${text}`),
  ].join('\n');
}

export type TurnQueueWorkMeta = {
  /** Raw utterance parts that were coalesced (after near-dup folding). */
  parts: string[];
  /** True when more than one distinct utterance was merged. */
  series: boolean;
};

export class CallTurnQueue {
  private working: boolean = false;
  private readonly pending: string[] = [];
  /** Mutex chain — only one exclusive section runs at a time. */
  private tail: Promise<void> = Promise.resolve();

  public get isWorking(): boolean {
    return this.working;
  }

  public get pendingCount(): number {
    return this.pending.length;
  }

  /**
   * Buffer user speech.
   * Empty string is allowed once — Vapi "assistant speaks first" Custom LLM
   * requests arrive with no user text and must still run the opening node.
   */
  public enqueue(userText: string): void {
    const text = userText.trim();
    const last = this.pending[this.pending.length - 1];
    if (last === text) return;
    // At most one empty opening token waiting in the queue.
    if (!text && this.pending.some((p) => p === '')) return;
    this.pending.push(text);
  }

  private drain(): string[] {
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
  public async runExclusive<T>(input: {
    userText: string;
    continueDraining?: () => boolean;
    /**
     * After the last queued utterance, wait this many ms for more ASR fragments
     * before running work. 0 / omitted = no hold (opening turn, tests).
     */
    listenHoldMs?: number;
    work: (combinedUserText: string, meta: TurnQueueWorkMeta) => Promise<T>;
  }): Promise<{ status: 'ran'; result: T } | { status: 'skipped' }> {
    this.enqueue(input.userText);

    let release!: () => void;
    const mySlot = new Promise<void>((resolve) => {
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
    let lastResult: T | undefined;
    try {
      const holdMs = input.listenHoldMs ?? 0;
      if (holdMs > 0 && this.pending.some((p) => p.trim().length > 0)) {
        await this.holdForMoreUtterances(holdMs);
      }

      do {
        const parts = this.drain();
        if (!parts.length) break;
        const combined = coalesceUserUtterances(parts);
        const nonEmptyParts = parts.map((p) => p.trim()).filter(Boolean);
        // Empty combined is valid for speak-first opening (parts === ['']).
        const openingOnly = nonEmptyParts.length === 0;
        if (!combined && !openingOnly) break;
        lastResult = await input.work(combined, {
          parts: openingOnly ? [''] : nonEmptyParts.length ? nonEmptyParts : parts,
          series: nonEmptyParts.length > 1,
        });
      } while (
        this.pending.length > 0 &&
        (input.continueDraining?.() ?? false)
      );

      return { status: 'ran', result: lastResult as T };
    } finally {
      this.working = false;
      release();
    }
  }

  /**
   * Debounce: wait until `holdMs` of silence after the last queued utterance,
   * capped at 2× holdMs from when the hold started.
   */
  private async holdForMoreUtterances(holdMs: number): Promise<void> {
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

/** Process-local queues keyed by provider call id. */
export class CallTurnQueueRegistry {
  private readonly queues: Map<string, CallTurnQueue> = new Map<string, CallTurnQueue>();

  public get(providerCallId: string): CallTurnQueue {
    let q = this.queues.get(providerCallId);
    if (!q) {
      q = new CallTurnQueue();
      this.queues.set(providerCallId, q);
    }
    return q;
  }

  public delete(providerCallId: string): void {
    this.queues.delete(providerCallId);
  }
}
