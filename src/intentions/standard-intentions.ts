/** Framework-standard intention ids (use in flow.yaml and portal nodes). */
export const STANDARD_INTENTIONS = {
  isGoodbye: 'studio.isGoodbye',
  isTransferToHuman: 'studio.isTransferToHuman',
  isPause: 'studio.isPause',
  /** Caller is angry / mad — handle as a standalone portal, not normal flow. */
  isMad: 'studio.isMad',
  /**
   * No candidate intention cleared the confidence threshold.
   * Standalone portal — ask to clarify / recover.
   */
  isUnknownTransition: 'studio.isUnknownTransition',
  /** Affirmative answer (yes / correct / sure / okay). */
  isPositive: 'studio.isPositive',
  /** Negative answer (no / incorrect / decline). */
  isNegative: 'studio.isNegative',
  /**
   * Caller went silent — Vapi idle hook / Studio timer injects this portal.
   * Ask “still there?” twice, then endCall.
   */
  isStillThere: 'studio.isStillThere',
  /** Synthetic: channel delivered tool results for the pending toolCall. */
  isToolResult: 'studio.isToolResult',
} as const;

export type StandardIntention =
  (typeof STANDARD_INTENTIONS)[keyof typeof STANDARD_INTENTIONS];
