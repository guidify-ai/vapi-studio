import type {
  CheapClaudeModelId,
  CheapGeminiModelId,
  CheapGrokModelId,
  CheapOpenAiModelId,
} from '@guidify-ai/vapi-studio';

/**
 * Brain wiring for this app. Change here — not in .env.
 *
 * Live adapters (stock JSON-LLM, cheap whitelist only):
 * - studio-chatgpt → ChatGptBrainAdapter (OPENAI_API_KEY)
 * - studio-claude  → ClaudeBrainAdapter  (ANTHROPIC_API_KEY)
 * - studio-gemini  → GeminiBrainAdapter  (GOOGLE_API_KEY / GEMINI_API_KEY)
 * - studio-grok    → GrokBrainAdapter    (XAI_API_KEY)
 *
 * Mock adapters (deterministic sequences; no provider network):
 * - mock | mock-chatgpt → MockChatGptBrainAdapter (alias: MockBrainAdapter)
 * - mock-claude         → MockClaudeBrainAdapter
 * - mock-gemini         → MockGeminiBrainAdapter
 * - mock-grok           → MockGrokBrainAdapter
 *
 * Default: live ChatGPT when OPENAI_API_KEY is set, otherwise mock-chatgpt.
 * Model must match the selected live adapter’s cheap whitelist.
 */
export type SampleBrainAdapterId =
  | 'mock'
  | 'mock-chatgpt'
  | 'mock-claude'
  | 'mock-gemini'
  | 'mock-grok'
  | 'studio-chatgpt'
  | 'studio-claude'
  | 'studio-gemini'
  | 'studio-grok';

export type SampleBrainModelId =
  | CheapOpenAiModelId
  | CheapClaudeModelId
  | CheapGeminiModelId
  | CheapGrokModelId;

export const brainConfig = {
  adapter: (process.env.OPENAI_API_KEY
    ? 'studio-chatgpt'
    : 'mock-chatgpt') as SampleBrainAdapterId,
  model: 'gpt-4.1-mini' as SampleBrainModelId,
  confidenceThreshold: 0.4,
};
