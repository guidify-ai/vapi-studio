/**
 * Pure helpers for ranked intention JSON + unknown-transition fallback.
 */

import { DEFAULT_INTENTION_PRIORITY } from '../conversation/conversation-history';
import type { IntentionCandidate } from '../conversation/types';

export const DEFAULT_BRAIN_CONFIDENCE_THRESHOLD = 0.4;
export const CONFIDENCE_DECIMALS = 6;

export interface RankedIntentionScore {
  name: string;
  confidence: number;
  reason?: string;
}

export interface BrainIntentionOption {
  name: string;
  boost?: number;
  /** Supervisor walk order. Default 1. */
  priority?: number;
  source?: 'listen' | 'portal' | 'flow' | 'runtime';
}

export function resolveConfidenceThreshold(explicit?: number): number {
  if (typeof explicit === 'number' && Number.isFinite(explicit)) {
    return roundConfidence(clamp01(explicit));
  }
  return DEFAULT_BRAIN_CONFIDENCE_THRESHOLD;
}

/** Clamp to [0, 1] then round to 6 decimal places. Never above 1. */
export function roundConfidence(n: number): number {
  return Number(clamp01(n).toFixed(CONFIDENCE_DECIMALS));
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}

export function resolveIntentionPriority(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_INTENTION_PRIORITY;
  }
  return value;
}

/** True when every scored intention is below the confidence threshold. */
export function allBelowConfidenceThreshold(
  scores: RankedIntentionScore[],
  threshold: number,
): boolean {
  if (!scores.length) {
    return true;
  }
  return scores.every((s) => roundConfidence(s.confidence ?? 0) < threshold);
}

/**
 * Convert model scores into IntentionCandidates.
 * Boost is recorded as a hint; it does not change Supervisor walk order.
 */
export function scoresToRankedCandidates(
  scores: RankedIntentionScore[],
  options: BrainIntentionOption[],
  meta: Record<string, unknown> = {},
): IntentionCandidate[] {
  const byName = new Map(options.map((o) => [o.name, o]));
  return scores.map((s) => {
    const confidence = roundConfidence(s.confidence);
    const option = byName.get(s.name);
    const boost = option?.boost ?? 0;
    const priority = resolveIntentionPriority(option?.priority);
    return {
      name: s.name,
      confidence,
      priority,
      rank: Math.round((1 - confidence) * 1_000_000),
      payload: {
        ...meta,
        confidence,
        reason: s.reason,
        listenBoost: boost || undefined,
        priority,
      },
    };
  });
}

/**
 * Supervisor walk order: higher priority first, then name A–Z.
 */
export function compareIntentionWalkOrder(
  a: Pick<IntentionCandidate, 'name' | 'priority'>,
  b: Pick<IntentionCandidate, 'name' | 'priority'>,
): number {
  const pa = resolveIntentionPriority(a.priority);
  const pb = resolveIntentionPriority(b.priority);
  if (pb !== pa) return pb - pa;
  return a.name.localeCompare(b.name);
}

export function orderIntentionsForWalk(
  intentions: IntentionCandidate[],
): IntentionCandidate[] {
  return [...intentions].sort(compareIntentionWalkOrder);
}

/**
 * Drop scores below threshold, except always keep isUnknownTransition
 * when it is the only remaining / fallback candidate.
 */
export function selectWalkableIntentions(
  intentions: IntentionCandidate[],
  threshold: number,
  unknownName: string,
): IntentionCandidate[] {
  const eligible = intentions.filter(
    (i) =>
      i.name === unknownName ||
      roundConfidence(i.confidence) >= threshold,
  );
  if (eligible.length) {
    return orderIntentionsForWalk(eligible);
  }
  const unknown = intentions.find((i) => i.name === unknownName);
  if (unknown) {
    return [unknown];
  }
  return [];
}
