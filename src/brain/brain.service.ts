/**
 * Brain barrel — port + stock adapters.
 * Apps may supply their own adapter (e.g. custom HTTP API) via VapiStudioModule.forRoot({ brainAdapter }).
 */
export {
  BRAIN_SERVICE,
  BRAIN_ADAPTER,
} from './brain.port';
export type {
  BrainService,
  BrainAdapter,
  BrainScanInput,
  BrainScanResult,
} from './brain.port';

export type {
  BrainJudgeRequest,
  BrainJudgeOptions,
  BrainJudgeResult,
} from './brain-judge';

export {
  MockBrainAdapter,
  MockBrainService,
} from './adapters/mock-brain.adapter';
export {
  MockChatGptBrainAdapter,
  MockClaudeBrainAdapter,
  MockGeminiBrainAdapter,
  MockGrokBrainAdapter,
} from './adapters/mock-provider-brains.adapter';
export { ChatGptBrainAdapter } from './adapters/chatgpt-brain.adapter';
export { ClaudeBrainAdapter } from './adapters/claude-brain.adapter';
export { GeminiBrainAdapter } from './adapters/gemini-brain.adapter';
export { GrokBrainAdapter } from './adapters/grok-brain.adapter';
