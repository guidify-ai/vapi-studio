import { Injectable } from '@nestjs/common';

export type BrainCallKind = 'scan' | 'clarify' | 'judge';

export interface BrainUsageRecord {
  kind: BrainCallKind;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  at: string;
}

export interface BrainUsageSummary {
  providerCallId: string;
  conversationId?: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  byModel: Record<
    string,
    {
      calls: number;
      promptTokens: number;
      completionTokens: number;
    }
  >;
  records: BrainUsageRecord[];
}

interface UsageBucket {
  providerCallId: string;
  conversationId?: string;
  records: BrainUsageRecord[];
}

/**
 * Per-call LLM usage ledger for stock Brain adapters (ChatGPT / Claude / Gemini / Grok).
 * Token counts only — cost is whatever the provider bills. Summarized at end of call.
 */
@Injectable()
export class BrainUsageTracker {
  private readonly byCall: Map<string, UsageBucket> = new Map<string, UsageBucket>();

  public beginCall(providerCallId: string, conversationId?: string): void {
    if (!providerCallId) return;
    const existing = this.byCall.get(providerCallId);
    if (existing) {
      if (conversationId) existing.conversationId = conversationId;
      return;
    }
    this.byCall.set(providerCallId, {
      providerCallId,
      conversationId,
      records: [],
    });
  }

  public record(input: {
    providerCallId: string;
    conversationId?: string;
    kind: BrainCallKind;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }): BrainUsageRecord {
    this.beginCall(input.providerCallId, input.conversationId);
    const bucket = this.byCall.get(input.providerCallId)!;
    const promptTokens = Math.max(0, Math.floor(input.promptTokens || 0));
    const completionTokens = Math.max(
      0,
      Math.floor(input.completionTokens || 0),
    );
    const record: BrainUsageRecord = {
      kind: input.kind,
      model: input.model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      at: new Date().toISOString(),
    };
    bucket.records.push(record);
    return record;
  }

  public summary(providerCallId: string): BrainUsageSummary | null {
    const bucket = this.byCall.get(providerCallId);
    if (!bucket) return null;
    const byModel: BrainUsageSummary['byModel'] = {};
    let promptTokens = 0;
    let completionTokens = 0;
    for (const r of bucket.records) {
      promptTokens += r.promptTokens;
      completionTokens += r.completionTokens;
      const row = byModel[r.model] ?? {
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
      };
      row.calls += 1;
      row.promptTokens += r.promptTokens;
      row.completionTokens += r.completionTokens;
      byModel[r.model] = row;
    }
    return {
      providerCallId,
      conversationId: bucket.conversationId,
      calls: bucket.records.length,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      byModel,
      records: [...bucket.records],
    };
  }


  public clear(providerCallId: string): void {
    this.byCall.delete(providerCallId);
  }
}
