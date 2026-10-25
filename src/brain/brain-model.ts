/** Model the stock adapters call: the app's provider model id. */
export interface BrainModelRef {
  id: string;
}

/** Token counts as reported by the provider (OpenAI-style names). */
export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};
