import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { ConversationHistory } from '../conversation/conversation-history';
import type { ConversationSchema, DefaultConversationSchema, SchemaMemory } from '../conversation/conversation-schema';
import type { EventService } from '../events/event.service';
import type { ConversationView } from '../node/agent-node';
import { INTENTION_RUN_KIND } from './intention-constants';
import type { IntentionCascadePhase } from './intention-constants';
export { INTENTION_CASCADE_PHASE, INTENTION_RUN_KIND, ROUTE_RESOLVED_VIA, DEFAULT_FORCE_INTENTION_PRIORITY, } from './intention-constants';
export type { IntentionCascadePhase, IntentionRunKind, RouteResolvedVia, } from './intention-constants';
/**
 * When this intention participates in Supervisor cascade.
 *
 * - `force` — evaluate `before()` **before** listen_resolve + Brain; if true, route
 *   immediately (`resolvedVia: intention_force`). Absolute code freedom for gates.
 * - `match` — after force cascade / with listen resolve: `match()` may return a
 *   local confidence and skip Brain for this name.
 * - `scan` — default; name is a Brain/listen candidate only (lifecycle optional).
 *
 * Prefer `INTENTION_CASCADE_PHASE` over raw strings in app code.
 */
/**
 * Optional result of `run()` after this intention is selected.
 * Prefer `goto` when the intention owns the destination (DRY breach OK).
 */
export type IntentionRunResult = {
    kind: typeof INTENTION_RUN_KIND.Goto;
    nodeId: string;
    reason?: string;
} | {
    kind: typeof INTENTION_RUN_KIND.Score;
    confidence: number;
    priority?: number;
    reason?: string;
};
export interface IntentionContext<TSchema extends ConversationSchema = DefaultConversationSchema> {
    runtime: SupervisedConversation;
    conversation: ConversationView<TSchema>;
    userText: string;
    events: EventService;
    memory: SchemaMemory<TSchema>;
    history: ConversationHistory;
    visitCount: (nodeId: string) => number;
    previousNodeId: string | null;
    /** Active listen intention names (empty when none). */
    listenIntentionNames: string[];
}
/**
 * Intention = code, like a Node — free to read memory/history/regex and decide.
 *
 * Meta (`phase`, `boost`, `priority`, `toNodeId`) lives on the class so cascade
 * and Brain hints are declared next to the logic, not only in YAML.
 *
 * Lifecycle (force / match phases):
 *   before() → authorize gate (false = skip)
 *   match()  → optional local confidence (null = defer to Brain)
 *   run()    → optional goto / score rewrite before Node walk
 *   after()  → teardown after selection
 */
export declare abstract class CodeIntention<TSchema extends ConversationSchema = DefaultConversationSchema> {
    /** Stable id — same string flow.yaml / listen lists / Brain candidates use. */
    abstract readonly name: string;
    /**
     * Cascade phase. Default `scan` preserves today’s string-only intentions.
     * Set `force` for Brain-free gates (phone missing, consent gap, …).
     */
    phase: IntentionCascadePhase;
    /** Brain scoring hint (listen/Brain). Does not by itself change walk order. */
    boost: number;
    /** Supervisor walk priority when this intention is ranked (default 1). */
    priority: number;
    /**
     * Optional hard destination when force/match wins.
     * Overridden if `run()` returns `{ kind: INTENTION_RUN_KIND.Goto, nodeId }`.
     */
    toNodeId?: string;
    /** Forensic / diagram label (optional). */
    reason?: string;
    before(_ctx: IntentionContext<TSchema>): Promise<boolean>;
    /**
     * Local confidence in `[0, 1]`, or `null` to leave scoring to Brain / listen.
     * Force phase defaults to `1` when `before()` passed and this is not overridden.
     */
    match(_ctx: IntentionContext<TSchema>): Promise<number | null>;
    run(_ctx: IntentionContext<TSchema>): Promise<IntentionRunResult | null>;
    after(_ctx: IntentionContext<TSchema>): Promise<void>;
}
export declare const STUDIO_INTENTION_REGISTRY: unique symbol;
export type CodeIntentionRegistry = Map<string, CodeIntention<any>>;
export declare function intentionContextFromRuntime(input: {
    runtime: SupervisedConversation;
    userText: string;
    events: EventService;
}): IntentionContext;
//# sourceMappingURL=code-intention.d.ts.map