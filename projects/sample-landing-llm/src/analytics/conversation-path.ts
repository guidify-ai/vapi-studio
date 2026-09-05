import type { NodeVisit } from '@guidify-ai/vapi-studio';
import { nodeLabel } from './flow-node-catalog';

const PORTAL_NODES = new Set([
  'pause',
  'mad',
  'unknownTransition',
  'transferToHuman',
  'stillThere',
  'continue',
]);

export interface ConversationPathSummary {
  signature: string;
  branchLabel: string;
  nodes: string[];
  portalHits: string[];
}

/** Collapse consecutive duplicates; keep portal detours visible once each. */
export function summarizeConversationPath(
  visits: NodeVisit[],
): ConversationPathSummary {
  const nodes: string[] = [];
  let prev = '';
  for (const v of visits) {
    const id = v.nodeId?.trim();
    if (!id || id === prev) continue;
    prev = id;
    nodes.push(id);
  }

  const portalHits = [...new Set(nodes.filter((id) => PORTAL_NODES.has(id)))];
  const branchLabel = inferBranchLabel(nodes, portalHits);
  const signature = nodes.join('→');

  return { signature, branchLabel, nodes, portalHits };
}

function inferBranchLabel(nodes: string[], portalHits: string[]): string {
  const last = nodes[nodes.length - 1] ?? '';
  const set = new Set(nodes);

  if (set.has('bookAppointment') || set.has('appointmentDone')) {
    return 'Appointment booked';
  }
  if (set.has('deliverEstimate') || set.has('instantDone')) {
    return 'Instant estimate delivered';
  }
  if (set.has('transferToHuman') || set.has('existingProject')) {
    if (set.has('transferToHuman')) return 'Existing project → transfer';
    if (set.has('existingProject')) return 'Existing project path';
  }
  if (portalHits.includes('mad')) return 'Mad / frustrated exit';
  if (portalHits.filter((p) => p === 'unknownTransition').length >= 2) {
    return 'Repeated unknown recovery';
  }
  if (set.has('identityCollect') && set.has('askFormSendConsent')) {
    return 'Identity + form path';
  }
  if (set.has('farewell') || set.has('goodbye')) {
    return last === 'goodbye' ? 'Portal goodbye' : 'Normal farewell';
  }
  if (nodes.length <= 3) return 'Short / early drop';
  return 'Other path';
}

export function pathDisplayTitle(summary: ConversationPathSummary): string {
  const labels = summary.nodes.map(nodeLabel);
  if (labels.length <= 6) return labels.join(' → ');
  return `${labels.slice(0, 3).join(' → ')} … ${labels.slice(-2).join(' → ')}`;
}
