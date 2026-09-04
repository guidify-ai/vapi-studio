/**
 * Hard caps on conversation length — fail-closed goodbye + endCall.
 * Every call must have finite turn and wall-clock bounds.
 */

export const STUDIO_CONVERSATION_LIMITS = Symbol('STUDIO_CONVERSATION_LIMITS');

/** Default: 40 Supervisor turns (opening + user/tool/force/entry-speak). */
export const DEFAULT_MAX_CONVERSATION_TURNS = 40;

/** Default: 20 minutes from runtime `createdAt`. */
export const DEFAULT_MAX_CONVERSATION_DURATION_MS = 20 * 60 * 1000;

/** Soft ceiling — apps may raise, not beyond. */
export const HARD_MAX_CONVERSATION_TURNS = 150;

/** Soft ceiling — apps may raise, not beyond (60 minutes). */
export const HARD_MAX_CONVERSATION_DURATION_MS = 60 * 60 * 1000;

export const DEFAULT_CONVERSATION_LIMIT_MESSAGE =
  "We've been talking for a while, so I'm going to end this call now. Please call back if you still need help.";

export type ConversationLimitReason = 'max_turns' | 'max_duration';

export interface ConversationLimitsConfig {
  /**
   * Max Supervisor turns (each `handleTurn` bumps `turn.turnNumber`).
   * Default 40. Clamped to 1…150.
   */
  maxTurns?: number;
  /**
   * Max wall-clock ms from `SupervisedConversation.createdAt`.
   * Default 20 minutes. Clamped to 1s…60 minutes.
   */
  maxDurationMs?: number;
  /** Spoken text before endCall when a limit fires. */
  endMessage?: string;
}

export interface ResolvedConversationLimits {
  maxTurns: number;
  maxDurationMs: number;
  endMessage: string;
}

export function resolveConversationLimits(
  input?: ConversationLimitsConfig,
): ResolvedConversationLimits {
  const maxTurns = clampInt(
    input?.maxTurns,
    DEFAULT_MAX_CONVERSATION_TURNS,
    1,
    HARD_MAX_CONVERSATION_TURNS,
  );
  const maxDurationMs = clampInt(
    input?.maxDurationMs,
    DEFAULT_MAX_CONVERSATION_DURATION_MS,
    1_000,
    HARD_MAX_CONVERSATION_DURATION_MS,
  );
  const endMessage =
    typeof input?.endMessage === 'string' && input.endMessage.trim()
      ? input.endMessage.trim()
      : DEFAULT_CONVERSATION_LIMIT_MESSAGE;
  return { maxTurns, maxDurationMs, endMessage };
}

export function evaluateConversationLimits(input: {
  turnNumber: number;
  createdAt: Date;
  now?: Date;
  limits: ResolvedConversationLimits;
}): { exceeded: true; reason: ConversationLimitReason; elapsedMs: number } | {
  exceeded: false;
  elapsedMs: number;
} {
  const now = input.now ?? new Date();
  const elapsedMs = Math.max(0, now.getTime() - input.createdAt.getTime());
  if (input.turnNumber > input.limits.maxTurns) {
    return { exceeded: true, reason: 'max_turns', elapsedMs };
  }
  if (elapsedMs > input.limits.maxDurationMs) {
    return { exceeded: true, reason: 'max_duration', elapsedMs };
  }
  return { exceeded: false, elapsedMs };
}

function clampInt(
  raw: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}
