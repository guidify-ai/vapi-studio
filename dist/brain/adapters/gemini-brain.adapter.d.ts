import { Logger } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import { type StudioBrainConfig } from '../brain-config';
import { type CheapGeminiModelPricing } from '../gemini-cheap-models';
import type { TokenUsage } from '../llm-model-pricing';
import { JsonLlmBrainAdapter, type JsonLlmCompleteInput } from './json-llm-brain.base';
/**
 * Vapi Studio Gemini Brain — Google Generative Language API on a **cheap Flash whitelist**.
 *
 * Env: `GOOGLE_API_KEY` (or `GEMINI_API_KEY`). Same scan/clarify/judge contracts (3s timeout).
 */
export declare class GeminiBrainAdapter extends JsonLlmBrainAdapter {
    protected readonly adapterId = "studio-gemini";
    protected readonly logger: Logger;
    constructor(usage: BrainUsageTracker, events: EventService, brainConfig?: StudioBrainConfig);
    protected requireApiKey(op: string): string;
    protected resolveModel(override?: string | null): CheapGeminiModelPricing;
    protected completeJson(input: JsonLlmCompleteInput): Promise<{
        content: string;
        usage: TokenUsage;
    }>;
}
//# sourceMappingURL=gemini-brain.adapter.d.ts.map