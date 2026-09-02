import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { ConversationHistory } from '../conversation/conversation-history';
import {
  countNodeVisits,
  lastVisitedNodeId,
} from '../conversation/conversation-history';
import type {
  ConversationSchema,
  DefaultConversationSchema,
  SchemaMemory,
  SchemaVariables,
} from '../conversation/conversation-schema';
import type { EventService } from '../events/event.service';
import type { ConversationView } from '../node/ra9-node';

/**
 * When this intention participates in Supervisor cascade.
 *
 * - `force` — evaluate `before()` **before** listen_resolve + Brain; if true, route
 *   immediately (`resolvedVia: intention_force`). Absolute code freedom for gates.
 * - `match` — after force cascade / with listen resolve: `match()` may return a
 *   local confidence and skip Brain for this name.
 * - `scan` — default; name is a Brain/listen candidate only (lifecycle optional).
 */
export type IntentionCascadePhase = 'force' | 'match' | 'scan';

/**
 * Optional result of `run()` after this intention is selected.
 * Prefer `goto` when the intention owns the destination (DRY breach OK).
 */
export type IntentionRunResult =
  | {
      kind: 'goto';
      nodeId: string;
      reason?: string;
    }
  | {
      kind: 'score';
      confidence: number;
      priority?: number;
      reason?: string;
    };

export interface IntentionContext<
  TSchema extends ConversationSchema = DefaultConversationSchema,
> {
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
export abstract class Ra9Intention<
  TSchema extends ConversationSchema = DefaultConversationSchema,
> {
  /** Stable id — same string flow.yaml / listen lists / Brain candidates use. */
  abstract readonly name: string;

  /**
   * Cascade phase. Default `scan` preserves today’s string-only intentions.
   * Set `force` for Brain-free gates (phone missing, consent gap, …).
   */
  phase: IntentionCascadePhase = 'scan';

  /** Brain scoring hint (listen/Brain). Does not by itself change walk order. */
  boost = 0;

  /** Supervisor walk priority when this intention is ranked (default 1). */
  priority = 1;

  /**
   * Optional hard destination when force/match wins.
   * Overridden if `run()` returns `{ kind: 'goto', nodeId }`.
   */
  toNodeId?: string;

  /** Forensic / diagram label (optional). */
  reason?: string;

  async before(_ctx: IntentionContext<TSchema>): Promise<boolean> {
    return true;
  }

  /**
   * Local confidence in `[0, 1]`, or `null` to leave scoring to Brain / listen.
   * Force phase defaults to `1` when `before()` passed and this is not overridden.
   */
  async match(_ctx: IntentionContext<TSchema>): Promise<number | null> {
    return this.phase === 'force' ? 1 : null;
  }

  async run(
    _ctx: IntentionContext<TSchema>,
  ): Promise<IntentionRunResult | null> {
    if (this.toNodeId) {
      return {
        kind: 'goto',
        nodeId: this.toNodeId,
        reason: this.reason,
      };
    }
    return null;
  }

  async after(_ctx: IntentionContext<TSchema>): Promise<void> {
    // no-op
  }
}

export const RA9_INTENTION_REGISTRY = Symbol('RA9_INTENTION_REGISTRY');

export type Ra9IntentionRegistry = Map<string, Ra9Intention<any>>;

export function intentionContextFromRuntime(input: {
  runtime: SupervisedConversation;
  userText: string;
  events: EventService;
}): IntentionContext {
  const { runtime, userText, events } = input;
  const memory = runtime.memory as SchemaMemory<DefaultConversationSchema>;
  const variables = runtime.variables as SchemaVariables<DefaultConversationSchema>;
  return {
    runtime,
    conversation: {
      id: runtime.conversationId ?? '',
      providerCallId: runtime.providerCallId,
      flowId: runtime.flowId,
      variables,
      memory,
    },
    userText,
    events,
    memory,
    history: runtime.history,
    visitCount: (nodeId) => countNodeVisits(runtime.history, nodeId),
    previousNodeId: lastVisitedNodeId(runtime.history),
    listenIntentionNames: (runtime.listenExpectation?.intentions ?? []).map(
      (i) => i.name,
    ),
  };
}
