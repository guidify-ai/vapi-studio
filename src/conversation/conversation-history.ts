/**
 * Compact conversation history for Brain scan + Node.before().
 * Lives on the in-memory SupervisedConversation for the active call.
 */

export const DEFAULT_INTENTION_PRIORITY = 1;
export const MAX_COMPACT_CHAT_MESSAGES = 24;
export const MAX_COMPACT_CHAT_CHARS = 280;
export const MAX_NODE_PATH = 40;

export interface CompactChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface NodeVisit {
  nodeId: string;
  intention: string;
  turnNumber: number;
  at: string;
}

export interface ConversationHistory {
  /** Rolling compact transcript (user + bot). */
  chat: CompactChatMessage[];
  /** Node path for before() (where we have been). */
  nodes: NodeVisit[];
}

export function emptyConversationHistory(): ConversationHistory {
  return { chat: [], nodes: [] };
}

export function compactText(text: string, max = MAX_COMPACT_CHAT_CHARS): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function appendChat(
  history: ConversationHistory,
  role: 'user' | 'assistant',
  text: string,
): void {
  const compact = compactText(text);
  if (!compact && role === 'user') {
    return;
  }
  if (!compact) return;
  history.chat.push({ role, text: compact });
  if (history.chat.length > MAX_COMPACT_CHAT_MESSAGES) {
    history.chat.splice(0, history.chat.length - MAX_COMPACT_CHAT_MESSAGES);
  }
}

export function appendNodeVisit(
  history: ConversationHistory,
  visit: NodeVisit,
): void {
  history.nodes.push(visit);
  if (history.nodes.length > MAX_NODE_PATH) {
    history.nodes.splice(0, history.nodes.length - MAX_NODE_PATH);
  }
}

export function countNodeVisits(
  history: ConversationHistory,
  nodeId: string,
): number {
  return history.nodes.filter((n) => n.nodeId === nodeId).length;
}

export function lastVisitedNodeId(
  history: ConversationHistory,
): string | null {
  return history.nodes.length
    ? history.nodes[history.nodes.length - 1].nodeId
    : null;
}
