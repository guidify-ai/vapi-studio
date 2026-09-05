import { Logger } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import { type StudioBrainConfig } from '../brain-config';
import { type CheapGrokModelPricing } from '../grok-cheap-models';
import type { TokenUsage } from '../llm-model-pricing';
import { JsonLlmBrainAdapter, type JsonLlmCompleteInput } from './json-llm-brain.base';
/**
 * Vapi Studio Grok Brain — xAI OpenAI-compatible Chat Completions on a **cheap whitelist**.
 *
 * Env: `XAI_API_KEY`. Same scan/clarify/judge contracts as ChatGPT (3s timeout).
 */
export declare class GrokBrainAdapter extends JsonLlmBrainAdapter {
    protected readonly adapterId = "studio-grok";
    protected readonly logger: Logger;
    constructor(usage: BrainUsageTracker, events: EventService, brainConfig?: StudioBrainConfig);
    protected requireApiKey(op: string): string;
    protected resolveModel(override?: string | null): CheapGrokModelPricing;
    protected completeJson(input: JsonLlmCompleteInput): Promise<{
        content: string;
        usage: TokenUsage;
    }>;
}
//# sourceMappingURL=grok-brain.adapter.d.ts.map