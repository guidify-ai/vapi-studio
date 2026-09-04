import type { IntentionCandidate } from '../conversation/types';
import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { ListenExpectation } from '../conversation/listen-expectation';
import type { BrainIntentionOption } from './brain-ranking';
import type {
  BrainClarifyRequest,
  BrainClarifyResult,
} from './brain-clarify';
import type {
  BrainJudgeRequest,
  BrainJudgeResult,
} from './brain-judge';

export interface BrainScanInput {
  runtime: SupervisedConversation;
  userText: string;
  /** Active listen registration from the previous/current Node. */
  listen?: ListenExpectation | null;
  /**
   * Limited intention set for this listen:
   * listen-prioritized next-node intentions + all portal intentions.
   */
  candidates?: BrainIntentionOption[];
  /** Default 0.4 — if all confidences are below this, studio.isUnknownTransition wins. */
  confidenceThreshold?: number;
  /** Compact rolling transcript so the scanner has call context. */
  history?: {
    chat: Array<{ role: 'user' | 'assistant'; text: string }>;
    nodes: Array<{ nodeId: string; intention: string; turnNumber: number }>;
  };
}

/**
 * Brain scan output: ranked intentions + optional structured extractions
 * declared on the active listen / sayAndListen.
 */
export interface BrainScanResult {
  intentions: IntentionCandidate[];
  /** Map of ListenExtractField.key → value. */
  extracted?: Record<string, unknown>;
}

/**
 * Brain port — Supervisor depends only on this.
 * Concrete providers live under `brain/adapters/*` (Mock, studio-chatgpt, Roofr API, …).
 */
export interface BrainService {
  scan(input: BrainScanInput): Promise<BrainScanResult>;
  /**
   * Free-form clarification: input + question + required object answer shape.
   * Always returns `{ answer: object }`.
   */
  clarify<TAnswer extends Record<string, unknown> = Record<string, unknown>>(
    request: BrainClarifyRequest,
  ): Promise<BrainClarifyResult<TAnswer>>;
  /**
   * LLM-as-a-judge: score stringifiable context against a goal + criteria.
   * Rare on the live call path; primary consumer is eval tests.
   */
  judge<TContext = unknown>(
    request: BrainJudgeRequest<TContext>,
  ): Promise<BrainJudgeResult>;
}

/** Alias emphasizing the adapter pattern for application wiring. */
export type BrainAdapter = BrainService;

export const BRAIN_SERVICE = Symbol('BRAIN_SERVICE');
/** Same token as BRAIN_SERVICE — prefer this name at the app boundary. */
export const BRAIN_ADAPTER = BRAIN_SERVICE;
