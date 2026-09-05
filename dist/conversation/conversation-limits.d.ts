/**
 * Hard caps on conversation length — fail-closed goodbye + endCall.
 * Every call must have finite turn and wall-clock bounds.
 */
export declare const STUDIO_CONVERSATION_LIMITS: unique symbol;
/** Default: 40 Supervisor turns (opening + user/tool/force/entry-speak). */
export declare const DEFAULT_MAX_CONVERSATION_TURNS = 40;
/** Default: 20 minutes from runtime `createdAt`. */
export declare const DEFAULT_MAX_CONVERSATION_DURATION_MS: number;
/** Soft ceiling — apps may raise, not beyond. */
export declare const HARD_MAX_CONVERSATION_TURNS = 150;
/** Soft ceiling — apps may raise, not beyond (60 minutes). */
export declare const HARD_MAX_CONVERSATION_DURATION_MS: number;
export declare const DEFAULT_CONVERSATION_LIMIT_MESSAGE = "We've been talking for a while, so I'm going to end this call now. Please call back if you still need help.";
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
export declare function resolveConversationLimits(input?: ConversationLimitsConfig): ResolvedConversationLimits;
export declare function evaluateConversationLimits(input: {
    turnNumber: number;
    createdAt: Date;
    now?: Date;
    limits: ResolvedConversationLimits;
}): {
    exceeded: true;
    reason: ConversationLimitReason;
    elapsedMs: number;
} | {
    exceeded: false;
    elapsedMs: number;
};
//# sourceMappingURL=conversation-limits.d.ts.map