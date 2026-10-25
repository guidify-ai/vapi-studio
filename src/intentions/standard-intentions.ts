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

/** Scanner descriptions for the framework intentions (apps may override per listen). */
export const STANDARD_INTENTION_DESCRIPTIONS: Record<StandardIntention, string> = {
  'studio.isGoodbye': 'The caller wants to end the call or is saying goodbye.',
  'studio.isTransferToHuman': 'The caller asks to speak with a real person, agent, or human.',
  'studio.isPause': 'The caller asks to hold on, wait, or pause for a moment.',
  'studio.isMad': 'The caller is angry, upset, hostile, or swearing at the assistant.',
  'studio.isUnknownTransition':
    'None of the other listed intentions fits what the caller said, or it is off-topic or unintelligible.',
  'studio.isPositive': 'The caller answers affirmatively: yes, correct, sure, okay.',
  'studio.isNegative': 'The caller answers negatively: no, incorrect, or declines.',
  'studio.isStillThere': 'The caller has gone silent and the assistant is checking they are still there.',
  'studio.isToolResult': 'The channel returned results for a pending tool call.',
};
