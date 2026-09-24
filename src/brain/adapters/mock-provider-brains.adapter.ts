/**
 * Named mock Brain adapters — same deterministic sequence engine as
 * {@link MockBrainAdapter}, tagged by intended live provider for app wiring.
 *
 * Use these when you want `brainConfig.adapter: 'mock-claude'` (etc.) without
 * calling Anthropic/Google/xAI/OpenAI. Behavior is identical across mocks;
 * only the class identity / `mockProvider` label differs.
 */

import { Injectable } from '@nestjs/common';
import { MockBrainAdapter } from './mock-brain.adapter';

@Injectable()
export class MockChatGptBrainAdapter extends MockBrainAdapter {
  public readonly mockProvider: 'chatgpt' = 'chatgpt';
}

@Injectable()
export class MockClaudeBrainAdapter extends MockBrainAdapter {
  public readonly mockProvider: 'claude' = 'claude';
}

@Injectable()
export class MockGeminiBrainAdapter extends MockBrainAdapter {
  public readonly mockProvider: 'gemini' = 'gemini';
}

@Injectable()
export class MockGrokBrainAdapter extends MockBrainAdapter {
  public readonly mockProvider: 'grok' = 'grok';
}
