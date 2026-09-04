/**
 * Brain barrel — port + stock adapters.
 * Apps may supply their own adapter (e.g. Roofr HTTP API) via VapiStudioModule.forRoot({ brainAdapter }).
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
export { ChatGptBrainAdapter } from './adapters/chatgpt-brain.adapter';
