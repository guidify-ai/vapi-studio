import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import {
  STUDIO_BRAIN_CONFIG,
  type StudioBrainConfig,
} from '../brain-config';
import {
  resolveCheapGrokModel,
  type CheapGrokModelPricing,
} from '../grok-cheap-models';
import type { TokenUsage } from '../llm-model-pricing';
import {
  JsonLlmBrainAdapter,
  JSON_LLM_BRAIN_TIMEOUT_MS,
  type JsonLlmCompleteInput,
} from './json-llm-brain.base';

type GrokChatResponse = {
  usage?: TokenUsage;
  choices?: Array<{ message?: { content?: string } }>;
};

/**
 * Vapi Studio Grok Brain — xAI OpenAI-compatible Chat Completions on a **cheap whitelist**.
 *
 * Env: `XAI_API_KEY`. Same scan/clarify/judge contracts as ChatGPT (3s timeout).
 */
@Injectable()
export class GrokBrainAdapter extends JsonLlmBrainAdapter {
  protected readonly adapterId = 'studio-grok';
  protected readonly logger = new Logger('GrokBrainAdapter');

  public constructor(
    usage: BrainUsageTracker,
    events: EventService,
    @Optional()
    @Inject(STUDIO_BRAIN_CONFIG)
    brainConfig?: StudioBrainConfig,
  ) {
    super(usage, events, brainConfig);
  }

  protected requireApiKey(op: string): string {
    const apiKey = process.env.XAI_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith('sk-mock') || apiKey === 'REPLACE_ME') {
      throw new Error(
        `GrokBrainAdapter.${op} requires a real XAI_API_KEY (not mock). ` +
          `Keep the app on MockBrainAdapter in code until Grok is enabled.`,
      );
    }
    return apiKey;
  }

  protected resolveModel(override?: string | null): CheapGrokModelPricing {
    return resolveCheapGrokModel(override || this.brainConfig?.model);
  }

  protected async completeJson(
    input: JsonLlmCompleteInput,
  ): Promise<{ content: string; usage: TokenUsage }> {
    const started = Date.now();
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(JSON_LLM_BRAIN_TIMEOUT_MS),
      body: JSON.stringify({
        model: input.model.id,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `xAI brain ${input.kind} failed: ${res.status} ${body}`,
      );
      throw new Error(`GrokBrainAdapter ${input.kind} error: ${res.status}`);
    }

    const json = (await res.json()) as GrokChatResponse;
    const content = json.choices?.[0]?.message?.content ?? '{}';
    const usage = json.usage ?? {};

    this.recordUsage({
      providerCallId: input.providerCallId,
      conversationId: input.conversationId,
      kind: input.kind,
      model: input.model,
      usage,
      started,
    });

    return { content, usage };
  }
}
