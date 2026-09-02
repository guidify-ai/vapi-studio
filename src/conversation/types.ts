export type ConversationStatus = 'ACTIVE' | 'ENDED';

export type SupervisedStatus = 'ACTIVE' | 'FINALIZING' | 'ENDED';

export interface IntentionCandidate {
  name: string;
  /**
   * Scanner confidence 0..1 inclusive, 6 decimal places.
   * Never greater than 1.
   */
  confidence: number;
  /**
   * Supervisor walk order (higher first). Default 1.
   * Independent from listen `boost` (that is a Brain hint).
   */
  priority: number;
  /**
   * @deprecated Sort key leftover — Supervisor orders by priority then name.
   * Still populated for logs (lower ≈ higher confidence).
   */
  rank: number;
  payload?: unknown;
}

export interface TransferPortalState {
  reengagementAttempts: number;
}

export interface StillTherePortalState {
  /** How many “are you still there?” asks have been spoken. */
  attempts: number;
}

/**
 * Active-call portal state. Lives only on the in-memory SupervisedConversation.
 * Entering a portal must not advance the normal flow node.
 */
export interface PortalState {
  activePortalId?: string | null;
  originNodeId?: string | null;
  transferToHuman: TransferPortalState;
  stillThere: StillTherePortalState;
}

export interface TurnState {
  turnNumber: number;
  interrupted: boolean;
  lastInterruptAt?: string;
}
