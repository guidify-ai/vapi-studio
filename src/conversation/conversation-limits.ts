/**
 * Conversation length bounds — fail-closed goodbye + endCall.
 * Every call must have finite turn and wall-clock bounds; the app picks the
 * values and the words spoken when one fires.
 */

export const STUDIO_CONVERSATION_LIMITS = Symbol('STUDIO_CONVERSATION_LIMITS');

/** Default: 40 Supervisor turns (opening + user/tool/force/entry-speak). */
export const DEFAULT_MAX_CONVERSATION_TURNS = 40;

/** Default: 20 minutes from runtime `createdAt`. */
export const DEFAULT_MAX_CONVERSATION_DURATION_MS = 20 * 60 * 1000;

export type ConversationLimitReason = 'max_turns' | 'max_duration';

export interface ConversationLimitsConfig {
  /**
   * Max Supervisor turns (each `handleTurn` bumps `turn.turnNumber`).
   * Default 40. Any positive integer.
   */
  maxTurns?: number;
  /**
   * Max wall-clock ms from `SupervisedConversation.createdAt`.
   * Default 20 minutes. At least 1s.
   */
  maxDurationMs?: number;
  /**
   * Spoken text before endCall when a limit fires. Required — the caller
   * hears it, so the app owns the wording and language.
   */
  endMessage: string;
}

export interface ResolvedConversationLimits {
  maxTurns: number;
  maxDurationMs: number;
  endMessage: string;
}

export function resolveConversationLimits(
  input?: ConversationLimitsConfig,
): ResolvedConversationLimits {
  const endMessage =
    typeof input?.endMessage === 'string' ? input.endMessage.trim() : '';
  if (!endMessage) {
    throw new Error(
      'VapiStudioModule.forRoot({ limits: { endMessage } }) is required — ' +
        'the words spoken when a conversation limit ends the call.',
    );
  }
  const maxTurns = positiveInt(input?.maxTurns, DEFAULT_MAX_CONVERSATION_TURNS, 1);
  const maxDurationMs = positiveInt(
    input?.maxDurationMs,
    DEFAULT_MAX_CONVERSATION_DURATION_MS,
    1_000,
  );
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

function positiveInt(
  raw: number | undefined,
  fallback: number,
  min: number,
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.floor(raw));
}
