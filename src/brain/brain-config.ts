/**
 * Application-supplied Brain settings (code layer, not .env).
 * Secrets (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / XAI_API_KEY) stay in the environment.
 */

import { DEFAULT_BRAIN_CONFIDENCE_THRESHOLD } from './brain-ranking';

export const STUDIO_BRAIN_CONFIG = Symbol('STUDIO_BRAIN_CONFIG');

export interface StudioBrainConfig {
  /**
   * Adapter-specific cheap whitelist model id.
   * Omit to use the selected adapter's default (e.g. gpt-4.1-nano, claude-haiku-4-5-…).
   */
  model?: string;
  /** Scan floor (0..1). Below for all candidates → unknown transition. Default 0.4. */
  confidenceThreshold?: number;
}

export type ResolvedStudioBrainConfig = {
  model?: string;
  confidenceThreshold: number;
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
  };
}
