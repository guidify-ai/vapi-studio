/** Supervisor cascade phase for a code intention class. */
export declare const INTENTION_CASCADE_PHASE: {
    /** Evaluate before listen resolve + Brain; route on `before()` / `run()`. */
    readonly Force: "force";
    /** Local `match()` confidence; may skip Brain for this name. */
    readonly Match: "match";
    /** Default — name is a Brain / listen candidate only. */
    readonly Scan: "scan";
};
export type IntentionCascadePhase = (typeof INTENTION_CASCADE_PHASE)[keyof typeof INTENTION_CASCADE_PHASE];
/** Result discriminator from `CodeIntention.run()`. */
export declare const INTENTION_RUN_KIND: {
    readonly Goto: "goto";
    readonly Score: "score";
};
export type IntentionRunKind = (typeof INTENTION_RUN_KIND)[keyof typeof INTENTION_RUN_KIND];
/**
 * `ROUTE_DECISION` / turn forensics — how the supervisor picked the next node.
 * Apps may emit additional strings; these are the framework-defined values.
 */
export declare const ROUTE_RESOLVED_VIA: {
    readonly ConditionForce: "condition_force";
    readonly ConditionBoost: "condition_boost";
    readonly IntentionForce: "intention_force";
    readonly IntentionMatch: "intention_match";
    readonly ListenResolve: "listen_resolve";
    readonly Brain: "brain";
    readonly ForceIntention: "force_intention";
    readonly Continue: "continue";
    /** Unknown portal restatement accepted against the origin listen. */
    readonly UnknownOriginConsume: "unknown_origin_consume";
    readonly RouteFallbackUnknown: "route_fallback_unknown";
};
export type RouteResolvedVia = (typeof ROUTE_RESOLVED_VIA)[keyof typeof ROUTE_RESOLVED_VIA];
/** Walk priority for force gates that must beat normal flow (phone missing, consent gap, …). */
export declare const DEFAULT_FORCE_INTENTION_PRIORITY = 1000000;
//# sourceMappingURL=intention-constants.d.ts.map