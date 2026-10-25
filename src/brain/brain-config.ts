/**
 * Application-supplied Brain settings (code layer, not .env).
 * Secrets (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / XAI_API_KEY) stay in the environment.
 *
 * Studio is model-agnostic: it ships no model list, default model, or prices.
 * Provider models come and go; the app picks one and owns its settings. Studio
 * reports token usage; cost is whatever the provider bills.
 */

import { DEFAULT_BRAIN_CONFIDENCE_THRESHOLD } from './brain-ranking';

export const STUDIO_BRAIN_CONFIG = Symbol('STUDIO_BRAIN_CONFIG');

export interface StudioBrainConfig {
  /**
   * Provider model id, passed through as-is (e.g. `gpt-6-luna`,
   * `claude-haiku-4-5-20251001`). Required by the stock LLM adapters.
   */
  model?: string;
  /** Scan floor (0..1). Below for all candidates → unknown transition. Default 0.4. */
  confidenceThreshold?: number;
  /**
   * Extra fields merged into the provider request body (one level deep, so
   * nested objects like Gemini `generationConfig` keep Studio's JSON settings).
   * Use for model-specific knobs, e.g. `{ reasoning_effort: 'none' }` or
   * `{ temperature: 0 }`. Studio sends no sampling settings on its own.
   */
  providerOptions?: Record<string, unknown>;
}

export type ResolvedStudioBrainConfig = {
  model?: string;
  confidenceThreshold: number;
  providerOptions?: Record<string, unknown>;
};

export function resolveStudioBrainConfig(
  input?: StudioBrainConfig,
): ResolvedStudioBrainConfig {
  return {
    model: input?.model?.trim() || undefined,
    confidenceThreshold:
      typeof input?.confidenceThreshold === 'number' &&
      Number.isFinite(input.confidenceThreshold)
        ? input.confidenceThreshold
        : DEFAULT_BRAIN_CONFIDENCE_THRESHOLD,
    providerOptions: input?.providerOptions,
  };
}

/**
 * Merge app `providerOptions` into a provider request body. Plain-object
 * values merge one level deep; everything else is replaced.
 */
export function mergeProviderOptions(
  body: Record<string, unknown>,
  options?: Record<string, unknown>,
): Record<string, unknown> {
  if (!options) return body;
  const out: Record<string, unknown> = { ...body };
  for (const [key, value] of Object.entries(options)) {
    const current = out[key];
    out[key] =
      isPlainObject(current) && isPlainObject(value)
        ? { ...current, ...value }
        : value;
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @deprecated Studio accepts any provider model id. Use `string`. */
export type CheapOpenAiModelId = string;
/** @deprecated Studio accepts any provider model id. Use `string`. */
export type CheapClaudeModelId = string;
/** @deprecated Studio accepts any provider model id. Use `string`. */
export type CheapGeminiModelId = string;
/** @deprecated Studio accepts any provider model id. Use `string`. */
export type CheapGrokModelId = string;
