/** Analytics event types for durable caller CRM (Postgres + Studio buffer). */
export const CALLER_EVENTS = {
  NEW: 'CALLER_NEW',
  RETURNING: 'CALLER_RETURNING',
  /** Named profile exists but recognizeReturningCaller FF is off. */
  RECOGNITION_SKIPPED: 'CALLER_RECOGNITION_SKIPPED',
  PROFILE_PRELOADED: 'CALLER_PROFILE_PRELOADED',
  RETURNING_CONFIRMED: 'CALLER_RETURNING_CONFIRMED',
  RETURNING_REJECTED: 'CALLER_RETURNING_REJECTED',
  PROFILE_SAVED: 'CALLER_PROFILE_SAVED',
} as const;

export type CallerEventType =
  (typeof CALLER_EVENTS)[keyof typeof CALLER_EVENTS];
