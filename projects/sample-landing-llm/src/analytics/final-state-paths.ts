import type { NodeVisit } from '@guidify-ai/vapi-studio';
import {
  summarizeConversationPath,
  type ConversationPathSummary,
} from './conversation-path';

export function nodeVisitsFromFinalState(
  finalState: Record<string, unknown> | null | undefined,
): NodeVisit[] {
  if (!finalState || typeof finalState !== 'object') return [];
  const history = finalState.history;
  if (!history || typeof history !== 'object' || Array.isArray(history)) return [];
  const nodes = (history as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  const out: NodeVisit[] = [];
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue;
    const n = raw as Record<string, unknown>;
    const nodeId = String(n.nodeId ?? '').trim();
    if (!nodeId) continue;
    out.push({
      nodeId,
      intention: String(n.intention ?? ''),
      turnNumber: Number(n.turnNumber) || 0,
      at: String(n.at ?? ''),
    });
  }
  return out;
}

export function memoryFromFinalState(
  finalState: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!finalState || typeof finalState !== 'object') return {};
  const memory = finalState.memory;
  if (!memory || typeof memory !== 'object' || Array.isArray(memory)) return {};
  return memory as Record<string, unknown>;
}

export function aggregatePathsFromFinalStates(
  rows: Array<{ id: string; finalState: Record<string, unknown> | null }>,
): Array<ConversationPathSummary & { conversations: number }> {
  const counts = new Map<string, ConversationPathSummary & { conversations: number }>();
  for (const row of rows) {
    const visits = nodeVisitsFromFinalState(row.finalState);
    if (!visits.length) continue;
    const summary = summarizeConversationPath(visits);
    if (!summary.signature) continue;
    const existing = counts.get(summary.signature);
    if (existing) {
      existing.conversations += 1;
    } else {
      counts.set(summary.signature, { ...summary, conversations: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.conversations - a.conversations);
}
