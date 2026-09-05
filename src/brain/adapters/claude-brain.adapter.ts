import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import {
  STUDIO_BRAIN_CONFIG,
  type StudioBrainConfig,
} from '../brain-config';
import {
  resolveCheapClaudeModel,
  type CheapClaudeModelPricing,
} from '../claude-cheap-models';
import type { TokenUsage } from '../llm-model-pricing';
import {
  JsonLlmBrainAdapter,
  JSON_LLM_BRAIN_TIMEOUT_MS,
  type JsonLlmCompleteInput,
} from './json-llm-brain.base';

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * Vapi Studio Claude Brain — Anthropic Messages API on a **cheap Haiku whitelist**.
 *
 * Env: `ANTHROPIC_API_KEY`. Same scan/clarify/judge contracts as ChatGPT (3s timeout).
 */
@Injectable()
export class ClaudeBrainAdapter extends JsonLlmBrainAdapter {
  protected readonly adapterId = 'studio-claude';
  protected readonly logger = new Logger('ClaudeBrainAdapter');

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
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith('sk-mock') || apiKey === 'REPLACE_ME') {
      throw new Error(
        `ClaudeBrainAdapter.${op} requires a real ANTHROPIC_API_KEY (not mock). ` +
          `Keep the app on MockBrainAdapter in code until Claude is enabled.`,
      );
    }
    return apiKey;
  }

  protected resolveModel(override?: string | null): CheapClaudeModelPricing {
    return resolveCheapClaudeModel(override || this.brainConfig?.model);
  }

  protected async completeJson(
    input: JsonLlmCompleteInput,
  ): Promise<{ content: string; usage: TokenUsage }> {
    const started = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': input.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(JSON_LLM_BRAIN_TIMEOUT_MS),
      body: JSON.stringify({
        model: input.model.id,
        max_tokens: 1024,
        temperature: 0,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Anthropic brain ${input.kind} failed: ${res.status} ${body}`,
      );
      throw new Error(`ClaudeBrainAdapter ${input.kind} error: ${res.status}`);
    }

    const json = (await res.json()) as AnthropicMessageResponse;
    const textParts = (json.content ?? [])
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text as string);
    const content = textParts.join('\n').trim() || '{}';
    const usage: TokenUsage = {
      prompt_tokens: json.usage?.input_tokens ?? 0,
      completion_tokens: json.usage?.output_tokens ?? 0,
      total_tokens:
        (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
    };

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
