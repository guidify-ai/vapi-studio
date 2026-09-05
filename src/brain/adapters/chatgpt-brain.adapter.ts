import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import {
  STUDIO_BRAIN_CONFIG,
  type StudioBrainConfig,
} from '../brain-config';
import {
  resolveCheapOpenAiModel,
  type CheapModelPricing,
} from '../openai-cheap-models';
import type { TokenUsage } from '../llm-model-pricing';
import {
  JsonLlmBrainAdapter,
  JSON_LLM_BRAIN_TIMEOUT_MS,
  type JsonLlmCompleteInput,
} from './json-llm-brain.base';

export { detectUserSpeechSeries } from './json-llm-brain.base';

type OpenAiChatResponse = {
  model?: string;
  usage?: TokenUsage;
  choices?: Array<{ message?: { content?: string } }>;
};

/**
 * Vapi Studio ChatGPT Brain adapter — OpenAI Chat Completions on a **cheap model whitelist**.
 *
 * Implements scan / clarify / judge via {@link JsonLlmBrainAdapter}.
 *
 * Env: OPENAI_API_KEY. Live voice: scan immediately, abort at 3s, first speech target <1.5s.
 */
@Injectable()
export class ChatGptBrainAdapter extends JsonLlmBrainAdapter {
  protected readonly adapterId = 'studio-chatgpt';
  protected readonly logger = new Logger('ChatGptBrainAdapter');

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
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith('sk-mock')) {
      throw new Error(
        `ChatGptBrainAdapter.${op} requires a real OPENAI_API_KEY (not mock). ` +
          `Keep the app on MockBrainAdapter in code until ChatGPT is enabled.`,
      );
    }
    return apiKey;
  }

  protected resolveModel(override?: string | null): CheapModelPricing {
    return resolveCheapOpenAiModel(override || this.brainConfig?.model);
  }

  protected async completeJson(
    input: JsonLlmCompleteInput,
  ): Promise<{ content: string; usage: TokenUsage }> {
    const started = Date.now();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
        `OpenAI brain ${input.kind} failed: ${res.status} ${body}`,
      );
      throw new Error(
        `ChatGptBrainAdapter ${input.kind} error: ${res.status}`,
      );
    }

    const json = (await res.json()) as OpenAiChatResponse;
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
