/**
 * Application-supplied Brain settings (code layer, not .env).
 * Secrets (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / XAI_API_KEY /
 * TYPESAFE_API_KEY) stay in the environment.
 *
 * Studio is model-agnostic: it ships no model list, default model, or prices.
 * Provider models come and go; the app picks one and owns its settings. Studio
 * reports token usage; cost is whatever the provider bills.
 */

import type { BrainAdapter } from './brain.port';
import type { BrainUsageTracker } from './brain-usage.tracker';
import type { EventService } from '../events/event.service';
import { DEFAULT_BRAIN_CONFIDENCE_THRESHOLD } from './brain-ranking';

export const STUDIO_BRAIN_CONFIG = Symbol('STUDIO_BRAIN_CONFIG');
/** LLM adapter instance that a decision Brain uses for extraction / clarify / judge. */
export const STUDIO_BRAIN_DELEGATE = Symbol('STUDIO_BRAIN_DELEGATE');

/** Stock LLM adapter constructor shape (ChatGpt / Claude / Gemini / Grok). */
export type BrainDelegateAdapterClass = new (
  usage: BrainUsageTracker,
  events: EventService,
  brainConfig?: StudioBrainConfig,
) => BrainAdapter;

export interface BrainDelegateConfig {
  /** LLM adapter class, e.g. `ChatGptBrainAdapter`. */
  adapter: BrainDelegateAdapterClass;
  /** Model id for the delegate (its own provider's id). */
  model: string;
  providerOptions?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface StudioBrainConfig {
  /**
   * Provider model id, passed through as-is (e.g. `gpt-6-luna`,
   * `claude-haiku-4-5-20251001`, `jev-latest`). Required by the stock adapters.
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
  /**
   * Abort a provider round-trip after this many ms (then unknown transition).
   * Default 3000. Pick it from the model's real latency and the call's budget.
   */
  timeoutMs?: number;
  /**
   * Memory sent to the scanner. Default: the whole memory snapshot. Return a
   * trimmed / redacted copy to keep PII or bulky values away from the provider.
   */
  memorySnapshot?: (memory: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Decision drivers (OpenAI Decisions, TypeSafe Jev) only score. Listen field
   * extraction, `clarify`, and `judge` go to this LLM adapter.
   */
  delegate?: BrainDelegateConfig;
}

export type ResolvedStudioBrainConfig = {
  model?: string;
  confidenceThreshold: number;
  providerOptions?: Record<string, unknown>;
  timeoutMs?: number;
  memorySnapshot?: (memory: Record<string, unknown>) => Record<string, unknown>;
  delegate?: BrainDelegateConfig;
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
    timeoutMs: positiveMs(input?.timeoutMs),
    memorySnapshot: input?.memorySnapshot,
    delegate: input?.delegate,
  };
}

/** Delegate settings as a Brain config for the delegate adapter's constructor. */
export function delegateBrainConfig(
  delegate: BrainDelegateConfig,
): StudioBrainConfig {
  return {
    model: delegate.model,
    providerOptions: delegate.providerOptions,
    timeoutMs: delegate.timeoutMs,
  };
}

/**
 * JSON-safe memory for the scanner: the app hook (if any), then drop values
 * JSON cannot carry (functions, undefined, cycles).
 */
export function scannerMemorySnapshot(
  memory: Record<string, unknown> | undefined,
  hook?: (memory: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> {
  const source = memory ?? {};
  const picked = hook ? hook({ ...source }) : source;
  try {
    const json = JSON.parse(JSON.stringify(picked ?? {}));
    return json && typeof json === 'object' && !Array.isArray(json) ? json : {};
  } catch {
    return {};
  }
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

function positiveMs(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
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
