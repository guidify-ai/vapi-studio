"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FORCE_INTENTION_PRIORITY = exports.ROUTE_RESOLVED_VIA = exports.INTENTION_RUN_KIND = exports.INTENTION_CASCADE_PHASE = void 0;
/** Supervisor cascade phase for a code intention class. */
exports.INTENTION_CASCADE_PHASE = {
    /** Evaluate before listen resolve + Brain; route on `before()` / `run()`. */
    Force: 'force',
    /** Local `match()` confidence; may skip Brain for this name. */
    Match: 'match',
    /** Default — name is a Brain / listen candidate only. */
    Scan: 'scan',
};
/** Result discriminator from `CodeIntention.run()`. */
exports.INTENTION_RUN_KIND = {
    Goto: 'goto',
    Score: 'score',
};
/**
 * `ROUTE_DECISION` / turn forensics — how the supervisor picked the next node.
 * Apps may emit additional strings; these are the framework-defined values.
 */
exports.ROUTE_RESOLVED_VIA = {
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
};
/** Walk priority for force gates that must beat normal flow (phone missing, consent gap, …). */
exports.DEFAULT_FORCE_INTENTION_PRIORITY = 1_000_000;
//# sourceMappingURL=intention-constants.js.map