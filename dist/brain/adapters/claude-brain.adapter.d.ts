import { Logger } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import { type StudioBrainConfig } from '../brain-config';
import { type CheapClaudeModelPricing } from '../claude-cheap-models';
import type { TokenUsage } from '../llm-model-pricing';
import { JsonLlmBrainAdapter, type JsonLlmCompleteInput } from './json-llm-brain.base';
/**
 * Vapi Studio Claude Brain — Anthropic Messages API on a **cheap Haiku whitelist**.
 *
 * Env: `ANTHROPIC_API_KEY`. Same scan/clarify/judge contracts as ChatGPT (3s timeout).
 */
export declare class ClaudeBrainAdapter extends JsonLlmBrainAdapter {
    protected readonly adapterId = "studio-claude";
    protected readonly logger: Logger;
    constructor(usage: BrainUsageTracker, events: EventService, brainConfig?: StudioBrainConfig);
    protected requireApiKey(op: string): string;
    protected resolveModel(override?: string | null): CheapClaudeModelPricing;
    protected completeJson(input: JsonLlmCompleteInput): Promise<{
        content: string;
        usage: TokenUsage;
    }>;
}
//# sourceMappingURL=claude-brain.adapter.d.ts.map