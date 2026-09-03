import { Injectable } from '@nestjs/common';
import { estimateUsdCost } from './openai-cheap-models';

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
  byModel: Record<
    string,
    {
      calls: number;
      promptTokens: number;
      completionTokens: number;
      estimatedUsd: number;
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
 * Per-call OpenAI usage ledger for ra9-chatgpt.
 * Printed as $$$ at end of call (finalize).
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
      estimatedUsd: estimateUsdCost({
        model: input.model,
        promptTokens,
        completionTokens,
      }),
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
    let estimatedUsd = 0;
    for (const r of bucket.records) {
      promptTokens += r.promptTokens;
      completionTokens += r.completionTokens;
      estimatedUsd += r.estimatedUsd;
      const row = byModel[r.model] ?? {
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedUsd: 0,
      };
      row.calls += 1;
      row.promptTokens += r.promptTokens;
      row.completionTokens += r.completionTokens;
      row.estimatedUsd += r.estimatedUsd;
      byModel[r.model] = row;
    }
    return {
      providerCallId,
      conversationId: bucket.conversationId,
      calls: bucket.records.length,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedUsd,
      byModel,
      records: [...bucket.records],
    };
  }

  /** Format a short money line for console / logs. */
  public formatMoney(usd: number): string {
    if (usd <= 0) return '$0.000000';
    if (usd < 0.01) return `$${usd.toFixed(6)}`;
    return `$${usd.toFixed(4)}`;
  }

  public clear(providerCallId: string): void {
    this.byCall.delete(providerCallId);
  }
}
