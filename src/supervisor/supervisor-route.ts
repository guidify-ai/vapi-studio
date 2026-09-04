import type { SupervisedConversation } from '../conversation/supervised-conversation';
import type { IntentionCandidate } from '../conversation/types';
import type { ListenExpectation } from '../conversation/listen-expectation';
import { DEFAULT_INTENTION_PRIORITY } from '../conversation/conversation-history';
import { STANDARD_INTENTIONS } from '../intentions/standard-intentions';
import { BufferedConversationOutput, type NodeResult } from '../output/conversation-output';
import {
  listenForensics,
  walkForensics,
  type RouteRejectRow,
  type RouteWinnerRow,
} from '../events/route-forensics';
import { snapshotUserMemory } from '../events/conversation-console';
import { ROUTE_RESOLVED_VIA } from '../intention/ra9-intention';
import { CONDITION_GOTO_PREFIX } from '../flow/flow-loader';
import { nodeContextFromRuntime } from '../node/ra9-node';
import type { SupervisorEngine } from './supervisor.types';
import { MAX_FORCE_INTENTION_HOPS } from './supervisor.types';


export async function routeIntentions(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  userText: string;
  output: BufferedConversationOutput;
  ranked: IntentionCandidate[];
  forceHop: number;
  resolvedVia?: string;
  confidenceThreshold?: number;
  activeListen?: ListenExpectation | null;
  allowMiss: true;
}): Promise<{
  selectedNodeId: string;
  selectedClass: string;
  result: NodeResult;
  portalOriginRestored?: string | null;
} | null>;
export async function routeIntentions(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  userText: string;
  output: BufferedConversationOutput;
  ranked: IntentionCandidate[];
  forceHop: number;
  resolvedVia?: string;
  confidenceThreshold?: number;
  activeListen?: ListenExpectation | null;
  allowMiss?: false;
}): Promise<{
  selectedNodeId: string;
  selectedClass: string;
  result: NodeResult;
  portalOriginRestored?: string | null;
}>;
export async function routeIntentions(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  userText: string;
  output: BufferedConversationOutput;
  ranked: IntentionCandidate[];
  forceHop: number;
  resolvedVia?: string;
  confidenceThreshold?: number;
  activeListen?: ListenExpectation | null;
  /** When true, return null instead of throwing if every candidate is rejected. */
  allowMiss?: boolean;
}): Promise<{
  selectedNodeId: string;
  selectedClass: string;
  result: NodeResult;
  portalOriginRestored?: string | null;
} | null> {
  const {
    runtime,
    userText,
    output,
    ranked,
    forceHop,
    resolvedVia,
    confidenceThreshold,
    activeListen,
    allowMiss,
  } = input;

  const rejected: RouteRejectRow[] = [];

  for (const scored of ranked) {
    const intentionName = scored.name;
    const nodeCandidates = this.flowLoader.nodesForIntention(intentionName);
    for (const candidate of nodeCandidates) {
      const node = this.nodes.get(candidate.class);
      if (!node) {
        rejected.push({
          nodeId: candidate.id,
          class: candidate.class,
          intention: intentionName,
          reason: 'missing',
          confidence: scored.confidence,
          priority: scored.priority,
        });
        this.events.log('warn', 'NODE_MISSING', {
          class: candidate.class,
          intention: intentionName,
        });
        continue;
      }

      // Idle still-there is forceIntention-only (channel timer). Do not let Brain
      // promote “hey?” / filler into the still-there portal mid-flow.
      if (
        intentionName === STANDARD_INTENTIONS.isStillThere &&
        runtime.portalState.activePortalId !== 'stillThere' &&
        resolvedVia !== ROUTE_RESOLVED_VIA.ForceIntention
      ) {
        rejected.push({
          nodeId: candidate.id,
          class: candidate.class,
          intention: intentionName,
          reason: 'still_there_requires_force',
          confidence: scored.confidence,
          priority: scored.priority,
        });
        this.events.log('info', 'NODE_REJECT', {
          conversationId: runtime.conversationId,
          runtimeInstanceId: runtime.runtimeInstanceId,
          nodeId: candidate.id,
          class: candidate.class,
          intention: intentionName,
          confidence: scored.confidence,
          priority: scored.priority,
          reason: 'still_there_requires_force',
        });
        continue;
      }

      const ctx = nodeContextFromRuntime({
        runtime,
        userText,
        output,
        events: this.events,
        brain: this.brain,
        integrations: this.integrations,
        forms: this.forms,
        intention: intentionName,
      });

      const can = await node.before(ctx);
      if (!can) {
        rejected.push({
          nodeId: candidate.id,
          class: candidate.class,
          intention: intentionName,
          reason: 'before_false',
          confidence: scored.confidence,
          priority: scored.priority,
        });
        this.events.log('info', 'NODE_REJECT', {
          conversationId: runtime.conversationId,
          runtimeInstanceId: runtime.runtimeInstanceId,
          nodeId: candidate.id,
          class: candidate.class,
          intention: intentionName,
          confidence: scored.confidence,
          priority: scored.priority,
          reason: 'before_false',
        });
        continue;
      }

      const winner: RouteWinnerRow = {
        nodeId: candidate.id,
        class: candidate.class,
        intention: intentionName,
        confidence: scored.confidence,
        priority: scored.priority,
        portal: Boolean(candidate.portal),
      };

      // isContinue: never speak “Okay, continuing.” — restore portal origin and
      // re-route the same utterance against that node’s listen. Only when a
      // portal is active; otherwise let ContinueNode.run (e.g. catch recovery).
      if (
        this.isContinueNode(candidate) &&
        runtime.portalState.activePortalId
      ) {
        await this.emitRouteDecision({
          runtime,
          userText,
          resolvedVia: resolvedVia ?? ROUTE_RESOLVED_VIA.Continue,
          confidenceThreshold,
          activeListen,
          ranked,
          rejected,
          winner: { ...winner, class: `${winner.class}→continue_replay` },
        });
        return this.replayOriginAfterContinue({
          runtime,
          userText,
          output,
          forceHop: forceHop + 1,
          fromNodeId: candidate.id,
        });
      }

      // Still-there “yes / still here” → silent origin resume (same as Continue).
      if (
        this.isStillThereNode(candidate) &&
        runtime.portalState.activePortalId === candidate.id &&
        (intentionName === STANDARD_INTENTIONS.isPositive ||
          intentionName === 'isContinue')
      ) {
        runtime.portalState.stillThere.attempts = 0;
        await this.emitRouteDecision({
          runtime,
          userText,
          resolvedVia: resolvedVia ?? ROUTE_RESOLVED_VIA.Continue,
          confidenceThreshold,
          activeListen,
          ranked,
          rejected,
          winner: { ...winner, class: `${winner.class}→continue_replay` },
        });
        return this.replayOriginAfterContinue({
          runtime,
          userText,
          output,
          forceHop: forceHop + 1,
          fromNodeId: candidate.id,
          resolvedVia: ROUTE_RESOLVED_VIA.Continue,
        });
      }

      await this.emitRouteDecision({
        runtime,
        userText,
        resolvedVia: this.resolveViaForWinner(
          resolvedVia,
          intentionName,
          forceHop,
        ),
        confidenceThreshold,
        activeListen,
        ranked,
        rejected,
        winner,
      });

      let portalOriginRestored: string | null | undefined;
      if (candidate.portal) {
        portalOriginRestored = this.enterPortal(runtime, candidate);
      } else {
        portalOriginRestored = this.enterNormal(runtime, candidate);
      }

      const executed = await this.executeNodeWithCatch({
        runtime,
        userText,
        output,
        node,
        candidate,
        intentionName,
        ctx,
        restarts: 0,
        forceHop,
      });

      if (executed.kind === 'forceIntention') {
        if (forceHop >= MAX_FORCE_INTENTION_HOPS) {
          throw new Error(
            `forceIntention hop limit (${MAX_FORCE_INTENTION_HOPS}) exceeded`,
          );
        }
        this.events.log('info', 'CATCH_FORCE_INTENTION', {
          conversationId: runtime.conversationId,
          runtimeInstanceId: runtime.runtimeInstanceId,
          fromNodeId: candidate.id,
          intention: executed.intention,
          forceHop: forceHop + 1,
        });
        return this.routeIntentions({
          runtime,
          userText,
          output,
          ranked: [
            {
              name: executed.intention,
              confidence: 1,
              priority: DEFAULT_INTENTION_PRIORITY,
              rank: 0,
            },
          ],
          forceHop: forceHop + 1,
          resolvedVia: ROUTE_RESOLVED_VIA.ForceIntention,
          confidenceThreshold,
          activeListen: runtime.listenExpectation,
        });
      }

      return {
        selectedNodeId: candidate.id,
        selectedClass: candidate.class,
        result: executed.result,
        portalOriginRestored,
      };
    }
  }

  await this.emitRouteDecision({
    runtime,
    userText,
    resolvedVia: resolvedVia ?? ROUTE_RESOLVED_VIA.Brain,
    confidenceThreshold,
    activeListen,
    ranked,
    rejected,
    winner: null,
    failed: true,
  });
  if (allowMiss) {
    return null;
  }
  // Brain/listen picked something every Node refused (before_false) — never 500
  // the channel. Recover through the unknown-transition portal once.
  if (
    resolvedVia !== ROUTE_RESOLVED_VIA.RouteFallbackUnknown &&
    forceHop < MAX_FORCE_INTENTION_HOPS
  ) {
    this.events.log('warn', 'ROUTE_FALLBACK_UNKNOWN', {
      conversationId: runtime.conversationId,
      runtimeInstanceId: runtime.runtimeInstanceId,
      turnNumber: runtime.turn.turnNumber,
      userText,
      rejected,
      note: 'all candidates before() false — falling back to ra9.isUnknownTransition',
    });
    return this.routeIntentions({
      runtime,
      userText,
      output,
      ranked: [
        {
          name: STANDARD_INTENTIONS.isUnknownTransition,
          confidence: 1,
          priority: 0,
          rank: 0,
        },
      ],
      forceHop: forceHop + 1,
      resolvedVia: ROUTE_RESOLVED_VIA.RouteFallbackUnknown,
      confidenceThreshold,
      activeListen,
    });
  }
  throw new Error('Supervisor could not route turn to any eligible node');
}



export function resolveViaForWinner(this: SupervisorEngine, 
  resolvedVia: string | undefined,
  intentionName: string,
  forceHop: number,
): string {
  if (resolvedVia === ROUTE_RESOLVED_VIA.ConditionForce) {
    return ROUTE_RESOLVED_VIA.ConditionForce;
  }
  if (resolvedVia === ROUTE_RESOLVED_VIA.IntentionForce) {
    return ROUTE_RESOLVED_VIA.IntentionForce;
  }
  if (resolvedVia === ROUTE_RESOLVED_VIA.IntentionMatch) {
    return ROUTE_RESOLVED_VIA.IntentionMatch;
  }
  if (intentionName.startsWith(CONDITION_GOTO_PREFIX)) {
    return ROUTE_RESOLVED_VIA.ConditionBoost;
  }
  return (
    resolvedVia ??
    (forceHop > 0
      ? ROUTE_RESOLVED_VIA.ForceIntention
      : ROUTE_RESOLVED_VIA.Brain)
  );
}

/** Durable + console forensic: why this node won (or none did). */



/** Durable + console forensic: why this node won (or none did). */
export async function emitRouteDecision(this: SupervisorEngine, input: {
  runtime: SupervisedConversation;
  userText: string;
  resolvedVia: string;
  confidenceThreshold?: number;
  activeListen?: ListenExpectation | null;
  ranked: IntentionCandidate[];
  rejected: RouteRejectRow[];
  winner: RouteWinnerRow | null;
  failed?: boolean;
}): Promise<void> {
  const {
    runtime,
    userText,
    resolvedVia,
    confidenceThreshold,
    activeListen,
    ranked,
    rejected,
    winner,
    failed,
  } = input;
  const type = failed ? 'ROUTE_FAILED' : 'ROUTE_DECISION';
  const payload = {
    runtimeInstanceId: runtime.runtimeInstanceId,
    providerCallId: runtime.providerCallId,
    turnNumber: runtime.turn.turnNumber,
    userText,
    resolvedVia,
    confidenceThreshold: confidenceThreshold ?? null,
    listen: listenForensics(activeListen),
    walk: walkForensics(ranked),
    rejected,
    winner,
    activePortalId: runtime.portalState.activePortalId ?? null,
    originNodeId: runtime.portalState.originNodeId ?? null,
    normalFlowNodeId: runtime.normalFlowNodeId ?? null,
    currentNodeId: runtime.currentNodeId ?? null,
    memory: snapshotUserMemory(runtime.memory as Record<string, unknown>),
  };
  if (runtime.conversationId) {
    await this.events.persist(runtime.conversationId, type, payload);
  } else {
    this.events.log(failed ? 'error' : 'info', type, payload);
  }
}

