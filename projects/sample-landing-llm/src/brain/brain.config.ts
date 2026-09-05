import type { CheapOpenAiModelId } from '@guidify-ai/vapi-studio';

/**
 * Brain wiring for this app. Change here — not in .env.
 *
 * Cheap whitelist only: gpt-4.1-nano (default), gpt-4o-mini, gpt-4.1-mini, gpt-5.4-nano.
 * Live driver: `studio-chatgpt` (ChatGptBrainAdapter). Mock sequences are unused
 * on the live path while this is set. Requires OPENAI_API_KEY in `.env`.
 * Experiment: gpt-4.1-mini (smarter, usually slower than nano). Flip back to
 * gpt-4.1-nano if first speech misses the 1.5s target or scan hits the 3s abort.
 */
export const brainConfig = {
  /** Prefer ChatGPT when OPENAI_API_KEY is set; mock uses config/poc/planner.brain.yml. */
  adapter: (process.env.OPENAI_API_KEY ? 'studio-chatgpt' : 'mock') as
    | 'mock'
    | 'studio-chatgpt',
  model: 'gpt-4.1-mini' as CheapOpenAiModelId,
  confidenceThreshold: 0.4,
};
