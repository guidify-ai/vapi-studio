import {
  type ConversationHookContext,
  type EventService,
  type NodeVisit,
} from '@guidify-ai/vapi-studio';
import type {
  PlannerSchema,
  PlannerVariables,
} from '../conversation/planner-schema';
import {
  CALL_ANALYTICS_EVENTS,
  type CallOutcome,
} from './call-analytics-events';
import { summarizeConversationPath } from './conversation-path';
import { PLANNER_ANALYTICS_TAGS } from './planner-funnels';

interface TriageContext {
  nodes: NodeVisit[];
  memory: Record<string, unknown>;
  endNodeId: string | null;
}

function buildTriageContext(
  ctx: ConversationHookContext<PlannerVariables>,
): TriageContext {
  const memory = ctx.runtime.memory as PlannerSchema['memory'];
  const nodes = ctx.runtime.history?.nodes ?? [];
  return {
    nodes,
    memory: {
      sampleShown: memory.sampleShown === true,
      quoteRequested: memory.quoteRequested === true,
      useCase: memory.useCase ?? null,
      discoveryComplete: memory.discoveryComplete === true,
      madStrikes: memory.madStrikes ?? 0,
    },
    endNodeId: nodes.length ? nodes[nodes.length - 1].nodeId : null,
  };
}

function heuristicOutcome(input: TriageContext): CallOutcome {
  const ids = input.nodes.map((n) => n.nodeId);
  const set = new Set(ids);

  if (input.memory.quoteRequested === true) return 'success';
  if (input.memory.sampleShown === true) return 'success';
  if (set.has('mad')) return 'failure';
  if (ids.filter((id) => id === 'unknownTransition').length >= 3) {
    return 'failure';
  }
  if (ids.length <= 2) return 'unknown';
  if (set.has('goodbye') && input.memory.discoveryComplete === true) {
    return 'success';
  }
  return 'unknown';
}

export function heuristicOutcomeFromSnapshot(
  finalState: Record<string, unknown> | null,
): CallOutcome {
  if (!finalState) return 'unknown';
  const memory = (finalState.memory as Record<string, unknown>) || {};
  const nodes = (finalState.nodes as NodeVisit[]) || [];
  return heuristicOutcome({
    nodes,
    memory,
    endNodeId: nodes.length ? nodes[nodes.length - 1].nodeId : null,
  });
}

export async function finalizeConversationAnalytics(
  ctx: ConversationHookContext<PlannerVariables>,
  events: EventService,
): Promise<void> {
  const triage = buildTriageContext(ctx);
  const outcome = heuristicOutcome(triage);
  const path = summarizeConversationPath(triage.nodes);

  await events.persist(
    ctx.runtime.conversationId,
    CALL_ANALYTICS_EVENTS.OUTCOME,
    {
      outcome,
      endNodeId: triage.endNodeId,
      pathSignature: path.signature,
      sampleShown: triage.memory.sampleShown === true,
      quoteRequested: triage.memory.quoteRequested === true,
    },
  );

  await events.persistAnalyticsTag(
    ctx.runtime.conversationId,
    PLANNER_ANALYTICS_TAGS.sessionEnded,
    { outcome },
  );
}
