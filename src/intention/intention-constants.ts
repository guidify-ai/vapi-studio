/** Supervisor cascade phase for a code intention class. */
export const INTENTION_CASCADE_PHASE = {
  /** Evaluate before listen resolve + Brain; route on `before()` / `run()`. */
  Force: 'force',
  /** Local `match()` confidence; may skip Brain for this name. */
  Match: 'match',
  /** Default — name is a Brain / listen candidate only. */
  Scan: 'scan',
} as const;

export type IntentionCascadePhase =
  (typeof INTENTION_CASCADE_PHASE)[keyof typeof INTENTION_CASCADE_PHASE];

/** Result discriminator from `CodeIntention.run()`. */
export const INTENTION_RUN_KIND = {
  Goto: 'goto',
  Score: 'score',
} as const;

export type IntentionRunKind =
  (typeof INTENTION_RUN_KIND)[keyof typeof INTENTION_RUN_KIND];

/**
 * `ROUTE_DECISION` / turn forensics — how the supervisor picked the next node.
 * Apps may emit additional strings; these are the framework-defined values.
 */
export const ROUTE_RESOLVED_VIA = {
  ConditionForce: 'condition_force',
  ConditionBoost: 'condition_boost',
  IntentionForce: 'intention_force',
  IntentionMatch: 'intention_match',
  ListenResolve: 'listen_resolve',
  Brain: 'brain',
  ForceIntention: 'force_intention',
  Continue: 'continue',
  /** Unknown portal restatement accepted against the origin listen. */
  UnknownOriginConsume: 'unknown_origin_consume',
  RouteFallbackUnknown: 'route_fallback_unknown',
} as const;

export type RouteResolvedVia =
  (typeof ROUTE_RESOLVED_VIA)[keyof typeof ROUTE_RESOLVED_VIA];

/** Walk priority for force gates that must beat normal flow (phone missing, consent gap, …). */
export const DEFAULT_FORCE_INTENTION_PRIORITY = 1_000_000;
