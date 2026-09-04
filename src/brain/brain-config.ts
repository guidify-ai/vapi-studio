/**
 * Application-supplied Brain settings (code layer, not .env).
 * Secrets (OPENAI_API_KEY) stay in the environment.
 */

import { DEFAULT_BRAIN_CONFIDENCE_THRESHOLD } from './brain-ranking';
import {
  DEFAULT_CHEAP_OPENAI_MODEL,
  type CheapOpenAiModelId,
} from './openai-cheap-models';

export const STUDIO_BRAIN_CONFIG = Symbol('STUDIO_BRAIN_CONFIG');

export interface StudioBrainConfig {
  /**
   * ChatGPT adapter model. Must be on the cheap whitelist.
   * Default: gpt-4.1-nano.
   */
  model?: CheapOpenAiModelId;
  /** Scan floor (0..1). Below for all candidates → unknown transition. Default 0.4. */
  confidenceThreshold?: number;
}

export function resolveStudioBrainConfig(
  input?: StudioBrainConfig,
): Required<StudioBrainConfig> {
  return {
    model: input?.model ?? DEFAULT_CHEAP_OPENAI_MODEL,
    confidenceThreshold:
      typeof input?.confidenceThreshold === 'number' &&
      Number.isFinite(input.confidenceThreshold)
        ? input.confidenceThreshold
        : DEFAULT_BRAIN_CONFIDENCE_THRESHOLD,
  };
}
