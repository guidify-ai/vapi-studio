import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import {
  STUDIO_BRAIN_CONFIG,
  type StudioBrainConfig,
} from '../brain-config';
import {
  resolveCheapGeminiModel,
  type CheapGeminiModelPricing,
} from '../gemini-cheap-models';
import type { TokenUsage } from '../llm-model-pricing';
import {
  JsonLlmBrainAdapter,
  JSON_LLM_BRAIN_TIMEOUT_MS,
  type JsonLlmCompleteInput,
} from './json-llm-brain.base';

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

/**
 * Vapi Studio Gemini Brain — Google Generative Language API on a **cheap Flash whitelist**.
 *
 * Env: `GOOGLE_API_KEY` (or `GEMINI_API_KEY`). Same scan/clarify/judge contracts (3s timeout).
 */
@Injectable()
export class GeminiBrainAdapter extends JsonLlmBrainAdapter {
  protected readonly adapterId = 'studio-gemini';
  protected readonly logger = new Logger('GeminiBrainAdapter');

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
    const apiKey =
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith('sk-mock') || apiKey === 'REPLACE_ME') {
      throw new Error(
        `GeminiBrainAdapter.${op} requires a real GOOGLE_API_KEY (or GEMINI_API_KEY). ` +
          `Keep the app on MockBrainAdapter in code until Gemini is enabled.`,
      );
    }
    return apiKey;
  }

  protected resolveModel(override?: string | null): CheapGeminiModelPricing {
    return resolveCheapGeminiModel(override || this.brainConfig?.model);
  }

  protected async completeJson(
    input: JsonLlmCompleteInput,
  ): Promise<{ content: string; usage: TokenUsage }> {
    const started = Date.now();
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(input.model.id)}:generateContent` +
      `?key=${encodeURIComponent(input.apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(JSON_LLM_BRAIN_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.system }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: input.user }],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Gemini brain ${input.kind} failed: ${res.status} ${body}`,
      );
      throw new Error(`GeminiBrainAdapter ${input.kind} error: ${res.status}`);
    }

    const json = (await res.json()) as GeminiGenerateResponse;
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const content =
      parts
        .map((p) => p.text)
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .join('\n')
        .trim() || '{}';
    const usage: TokenUsage = {
      prompt_tokens: json.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: json.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: json.usageMetadata?.totalTokenCount,
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
