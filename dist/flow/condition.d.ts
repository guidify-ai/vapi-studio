/**
 * Safe, Brain-free condition evaluation for flow transitions.
 * No `eval` — path lookups + a tiny boolean/compare grammar.
 *
 * Paths: `memory.foo`, `variables.bar` (also `var.` alias for variables).
 * Ops: `==`, `!=`, `!path` (falsy), bare `path` (truthy).
 * Join: `&&`, `||` (&& binds tighter). Parentheses supported.
 */
export type ConditionContext = {
    memory: Record<string, unknown>;
    variables: Record<string, unknown>;
};
/** Compile a condition string into a predicate. Throws on syntax error. */
export declare function compileCondition(expression: string): (ctx: ConditionContext) => boolean;
/** Evaluate once (compiles each call — prefer compileCondition in hot paths). */
export declare function evaluateCondition(expression: string, ctx: ConditionContext): boolean;
export interface FlowConditionTransition {
    id: string;
    /** If set, only when current node is one of these (or absent = any except `to`). */
    from?: string[];
    /** Destination node id in the same flow. */
    to: string;
    /** Condition expression over memory / variables. */
    when: string;
    /**
     * true → skip listen_resolve + Brain; route straight to `to`.
     * false → inject a high-priority synthetic intention for cascade with Brain.
     */
    force?: boolean;
    /** Walk / log priority when force=false (default 1_000_000). */
    priority?: number;
    /** Forensic reason string (also FLOW_CONTINUE-style). */
    reason?: string;
}
//# sourceMappingURL=condition.d.ts.map