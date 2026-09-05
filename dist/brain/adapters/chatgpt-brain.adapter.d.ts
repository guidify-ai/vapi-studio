import { Logger } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import { type StudioBrainConfig } from '../brain-config';
import { type CheapModelPricing } from '../openai-cheap-models';
import type { TokenUsage } from '../llm-model-pricing';
import { JsonLlmBrainAdapter, type JsonLlmCompleteInput } from './json-llm-brain.base';
export { detectUserSpeechSeries } from './json-llm-brain.base';
/**
 * Vapi Studio ChatGPT Brain adapter — OpenAI Chat Completions on a **cheap model whitelist**.
 *
 * Implements scan / clarify / judge via {@link JsonLlmBrainAdapter}.
 *
 * Env: OPENAI_API_KEY. Live voice: scan immediately, abort at 3s, first speech target <1.5s.
 */
export declare class ChatGptBrainAdapter extends JsonLlmBrainAdapter {
    protected readonly adapterId = "studio-chatgpt";
    protected readonly logger: Logger;
    constructor(usage: BrainUsageTracker, events: EventService, brainConfig?: StudioBrainConfig);
    protected requireApiKey(op: string): string;
    protected resolveModel(override?: string | null): CheapModelPricing;
    protected completeJson(input: JsonLlmCompleteInput): Promise<{
        content: string;
        usage: TokenUsage;
    }>;
}
//# sourceMappingURL=chatgpt-brain.adapter.d.ts.map