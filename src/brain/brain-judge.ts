/**
 * Brain judge — LLM-as-a-judge.
 * Rare on the live call path; the primary consumer is eval tests.
 *
 * Given stringifiable context + a plain-language goal + success/failure
 * criteria, adapters return pass/fail, reasoning bullets, and confidence.
 */

import { CONFIDENCE_DECIMALS, clamp01 } from './brain-ranking';

/** Default: no confidence floor — callers opt in via options.confidenceThreshold. */
export const DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD = 0;

/** Confidence as a fixed 6-decimal string, e.g. "0.850000". Always matches /^\d\.\d{6}$/. */
export const CONFIDENCE_6_PATTERN = /^\d\.\d{6}$/;

export type Confidence6 = string;

export interface BrainJudgeOptions {
  /**
   * 0..1. Does not change `passed` (that is the model judgment).
   * Sets `belowThreshold` when formatted confidence is below this floor.
   * Trusted pass = `passed && !belowThreshold`.
   */
  confidenceThreshold?: number;
  /**
   * OpenAI model id for this call (studio-chatgpt cheap whitelist).
   * Ignored by mock. Falls back to Ra9Module brain.model.
   */
  model?: string;
}

export interface BrainJudgeRequest<TContext = unknown> {
  /** Transcript, memory snapshot, or any JSON-serializable eval fixture. */
  context: TContext;
  /** What “good” means, in plain language. */
  goals: string;
  /** Criteria that must hold for a pass. */
  successConditions: string[];
  /** Criteria that force a fail if observed. */
  failureConditions: string[];
  options?: BrainJudgeOptions;
  /** Optional correlation for usage / console (filled by NodeContext). */
  meta?: {
    providerCallId?: string;
    conversationId?: string;
  };
}

export interface BrainJudgeResult {
  /** Model pass/fail. Threshold is not mixed in; see `belowThreshold`. */
  passed: boolean;
  /** Short reasons for why it passed or failed. */
  reasoning: string[];
  /** Certainty in [0,1], always 6 decimal places: "0.850000". */
  confidence: Confidence6;
  /** True when confidence is below options.confidenceThreshold. */
  belowThreshold: boolean;
}

export function resolveJudgeConfidenceThreshold(
  value: number | undefined,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD;
  }
  return Math.min(1, Math.max(0, value));
}

export function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return clamp01(n);
}

/** Clamp to [0, 1] and format as `\d.\d\d\d\d\d\d`. */
export function formatConfidence6(value: unknown): Confidence6 {
  return clampConfidence(value).toFixed(CONFIDENCE_DECIMALS);
}

export function isConfidence6(value: string): value is Confidence6 {
  return CONFIDENCE_6_PATTERN.test(value);
}

export function normalizeReasoning(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
    return [];
  }
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

/**
 * JSON-stringify objects; pass strings through.
 * Prefer this over clarifiableInputToString so `{foo:1}` is not `[object Object]`.
 */
export function judgeContextToString(context: unknown): string {
  if (context === null || context === undefined) return '';
  if (typeof context === 'string') return context;
  if (
    typeof context === 'number' ||
    typeof context === 'boolean' ||
    typeof context === 'bigint'
  ) {
    return String(context);
  }
  if (context instanceof Date) {
    return context.toISOString();
  }
  try {
    return JSON.stringify(context);
  } catch {
    try {
      return String(context);
    } catch {
      return '';
    }
  }
}

/**
 * Normalize raw Brain JSON into a judge result.
 * `passed` is the model judgment; threshold only sets `belowThreshold`.
 */
export function normalizeJudgeResult(
  raw: unknown,
  options?: BrainJudgeOptions,
): BrainJudgeResult {
  const threshold = resolveJudgeConfidenceThreshold(
    options?.confidenceThreshold,
  );
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const passed =
    obj.passed === true ||
    obj.verdict === true ||
    (typeof obj.passed === 'string' &&
      /^(true|pass|passed|yes)$/i.test(obj.passed));

  const confidence = formatConfidence6(obj.confidence);
  const reasoning = normalizeReasoning(obj.reasoning);
  const belowThreshold = Number(confidence) < threshold;

  if (!reasoning.length) {
    reasoning.push(
      Object.keys(obj).length === 0
        ? 'invalid_judge_payload'
        : passed
          ? 'passed'
          : 'failed',
    );
  }

  return {
    passed,
    reasoning,
    confidence,
    belowThreshold,
  };
}
