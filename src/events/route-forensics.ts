import type {
  ListenExpectation,
  SayAndListenOptions,
} from '../conversation/listen-expectation';
import type { IntentionCandidate } from '../conversation/types';
import type { NodeResult } from '../output/conversation-output';

export type RouteRejectReason =
  | 'before_false'
  | 'missing'
  | 'still_there_requires_force';

export interface RouteRejectRow {
  nodeId: string;
  class: string;
  intention: string;
  reason: RouteRejectReason;
  confidence?: number;
  priority?: number;
}

export interface RouteWinnerRow {
  nodeId: string;
  class: string;
  intention: string;
  confidence: number;
  priority: number;
  portal: boolean;
}

export function truncateForLog(text: string | undefined, max = 200): string | undefined {
  if (text == null) return undefined;
  const t = text.trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

export function listenForensics(
  listen: ListenExpectation | SayAndListenOptions | null | undefined,
): Record<string, unknown> | null {
  if (!listen) return null;
  const intentions = listen.intentions ?? [];
  return {
    intentions: intentions.map((i) => ({
      name: i.name,
      boost: i.boost,
      priority: i.priority,
    })),
    extractKeys: (listen.extract?.fields ?? []).map((f) => f.key),
    timeoutSeconds: listen.timeoutSeconds ?? null,
    hasResolveIntention:
      'resolveIntention' in listen &&
      typeof (listen as ListenExpectation).resolveIntention === 'function',
  };
}

export function walkForensics(ranked: IntentionCandidate[]): Array<{
  name: string;
  confidence: number;
  priority: number;
  listenBoost?: number;
  reason?: string;
}> {
  return ranked.map((row) => {
    const payload =
      row.payload && typeof row.payload === 'object'
        ? (row.payload as { listenBoost?: number; reason?: string })
        : {};
    return {
      name: row.name,
      confidence: row.confidence,
      priority: row.priority,
      listenBoost: payload.listenBoost,
      reason: payload.reason,
    };
  });
}

export function nodeResultForensics(result: NodeResult): Record<string, unknown> {
  const detail: Record<string, unknown> = { kind: result.kind };
  const text = truncateForLog(result.text);
  if (text) detail.text = text;
  if (result.continueToNodeId) detail.continueToNodeId = result.continueToNodeId;
  if (result.handoffReason) detail.reason = result.handoffReason;
  if (result.handoffTo) detail.handoffTo = result.handoffTo;
  if (result.destination) detail.destination = result.destination;
  if (result.toolCall?.name) {
    detail.toolCall = {
      name: result.toolCall.name,
      arguments: result.toolCall.arguments ?? {},
    };
  }
  if (result.sayAndListen) {
    detail.listen = listenForensics(result.sayAndListen);
  }
  return detail;
}

export function actionForensics(
  actions: Array<{ kind: string; text?: string; continueToNodeId?: string; handoffReason?: string; handoffTo?: string }>,
): Array<Record<string, unknown>> {
  return actions.map((a) => {
    const row: Record<string, unknown> = { kind: a.kind };
    const text = truncateForLog(a.text, 120);
    if (text) row.text = text;
    if (a.continueToNodeId) row.continueToNodeId = a.continueToNodeId;
    if (a.handoffReason) row.reason = a.handoffReason;
    if (a.handoffTo) row.handoffTo = a.handoffTo;
    return row;
  });
}
