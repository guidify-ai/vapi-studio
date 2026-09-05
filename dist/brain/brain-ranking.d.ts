/**
 * Pure helpers for ranked intention JSON + unknown-transition fallback.
 */
import type { IntentionCandidate } from '../conversation/types';
export declare const DEFAULT_BRAIN_CONFIDENCE_THRESHOLD = 0.4;
export declare const CONFIDENCE_DECIMALS = 6;
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
export declare function resolveConfidenceThreshold(explicit?: number): number;
/** Clamp to [0, 1] then round to 6 decimal places. Never above 1. */
export declare function roundConfidence(n: number): number;
export declare function clamp01(n: number): number;
export declare function resolveIntentionPriority(value?: number): number;
/** True when every scored intention is below the confidence threshold. */
export declare function allBelowConfidenceThreshold(scores: RankedIntentionScore[], threshold: number): boolean;
/**
 * Convert model scores into IntentionCandidates.
 * Boost is recorded as a hint; it does not change Supervisor walk order.
 */
export declare function scoresToRankedCandidates(scores: RankedIntentionScore[], options: BrainIntentionOption[], meta?: Record<string, unknown>): IntentionCandidate[];
/**
 * Supervisor walk order: higher priority first, then name A–Z.
 */
export declare function compareIntentionWalkOrder(a: Pick<IntentionCandidate, 'name' | 'priority'>, b: Pick<IntentionCandidate, 'name' | 'priority'>): number;
export declare function orderIntentionsForWalk(intentions: IntentionCandidate[]): IntentionCandidate[];
/**
 * Drop scores below threshold, except always keep isUnknownTransition
 * when it is the only remaining / fallback candidate.
 */
export declare function selectWalkableIntentions(intentions: IntentionCandidate[], threshold: number, unknownName: string): IntentionCandidate[];
//# sourceMappingURL=brain-ranking.d.ts.map