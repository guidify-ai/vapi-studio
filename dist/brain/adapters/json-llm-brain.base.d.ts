/**
 * Shared JSON-LLM Brain orchestration (scan / clarify / judge).
 * Provider adapters only implement auth, model whitelist, and completeJson().
 */
import { Logger } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import type { BrainAdapter, BrainScanInput, BrainScanResult } from '../brain.port';
import { type BrainClarifyRequest, type BrainClarifyResult } from '../brain-clarify';
import { type BrainJudgeRequest, type BrainJudgeResult } from '../brain-judge';
import type { LlmModelPricing, TokenUsage } from '../llm-model-pricing';
import { BrainUsageTracker } from '../brain-usage.tracker';
import type { StudioBrainConfig } from '../brain-config';
/** Fail the provider round-trip rather than stalling a live call. */
export declare const JSON_LLM_BRAIN_TIMEOUT_MS = 3000;
export type JsonLlmCompleteInput = {
    apiKey: string;
    model: LlmModelPricing;
    kind: 'scan' | 'clarify' | 'judge';
    providerCallId: string;
    conversationId?: string;
    system: string;
    user: string;
};
/**
 * Template for stock Brain adapters that call a JSON-capable LLM.
 * Subclasses supply API key, model whitelist, and the HTTP completion call.
 */
export declare abstract class JsonLlmBrainAdapter implements BrainAdapter {
    protected readonly usage: BrainUsageTracker;
    protected readonly events: EventService;
    protected readonly brainConfig?: StudioBrainConfig | undefined;
    protected abstract readonly adapterId: string;
    protected abstract readonly logger: Logger;
    protected constructor(usage: BrainUsageTracker, events: EventService, brainConfig?: StudioBrainConfig | undefined);
    protected abstract requireApiKey(op: string): string;
    protected abstract resolveModel(override?: string | null): LlmModelPricing;
    protected abstract completeJson(input: JsonLlmCompleteInput): Promise<{
        content: string;
        usage: TokenUsage;
    }>;
    scan(input: BrainScanInput): Promise<BrainScanResult>;
    clarify<TAnswer extends Record<string, unknown> = Record<string, unknown>>(request: BrainClarifyRequest): Promise<BrainClarifyResult<TAnswer>>;
    judge<TContext = unknown>(request: BrainJudgeRequest<TContext>): Promise<BrainJudgeResult>;
    /** Record usage after a successful provider call (shared by adapters). */
    protected recordUsage(input: {
        providerCallId: string;
        conversationId?: string;
        kind: 'scan' | 'clarify' | 'judge';
        model: LlmModelPricing;
        usage: TokenUsage;
        started: number;
    }): void;
    private filterExtracted;
    private resolveCandidates;
    private unknownIntention;
}
/** Detect CallTurnQueue coalesced multi-utterance user text. */
export declare function detectUserSpeechSeries(userText: string): {
    isSeries: boolean;
    parts: string[];
};
export declare function safeJsonParse(content: string): unknown;
//# sourceMappingURL=json-llm-brain.base.d.ts.map