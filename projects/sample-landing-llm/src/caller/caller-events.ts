/** Analytics event types for durable caller CRM (Postgres + Studio buffer). */
export const CALLER_EVENTS = {
  NEW: 'CALLER_NEW',
  RETURNING: 'CALLER_RETURNING',
  PROFILE_PRELOADED: 'CALLER_PROFILE_PRELOADED',
  PROFILE_SAVED: 'CALLER_PROFILE_SAVED',
} as const;

export type CallerEventType =
  (typeof CALLER_EVENTS)[keyof typeof CALLER_EVENTS];
