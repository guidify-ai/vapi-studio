export const CALL_ANALYTICS_EVENTS = {
  PATH: 'CONVERSATION_PATH',
  OUTCOME: 'CALL_OUTCOME',
} as const;

export type CallOutcome = 'success' | 'failure' | 'unknown';

export const CALL_OUTCOMES: CallOutcome[] = ['success', 'failure', 'unknown'];
