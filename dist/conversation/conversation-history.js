"use strict";
/**
 * Compact conversation history for Brain scan + Node.before().
 * Lives on the in-memory SupervisedConversation for the active call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_NODE_PATH = exports.MAX_COMPACT_CHAT_CHARS = exports.MAX_COMPACT_CHAT_MESSAGES = exports.DEFAULT_INTENTION_PRIORITY = void 0;
exports.emptyConversationHistory = emptyConversationHistory;
exports.compactText = compactText;
exports.appendChat = appendChat;
exports.appendNodeVisit = appendNodeVisit;
exports.countNodeVisits = countNodeVisits;
exports.lastVisitedNodeId = lastVisitedNodeId;
exports.DEFAULT_INTENTION_PRIORITY = 1;
exports.MAX_COMPACT_CHAT_MESSAGES = 24;
exports.MAX_COMPACT_CHAT_CHARS = 280;
exports.MAX_NODE_PATH = 40;
function emptyConversationHistory() {
    return { chat: [], nodes: [] };
}
function compactText(text, max = exports.MAX_COMPACT_CHAT_CHARS) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= max)
        return t;
    return `${t.slice(0, max)}…`;
}
function appendChat(history, role, text) {
    const compact = compactText(text);
    if (!compact && role === 'user') {
        return;
    }
    if (!compact)
        return;
    history.chat.push({ role, text: compact });
    if (history.chat.length > exports.MAX_COMPACT_CHAT_MESSAGES) {
        history.chat.splice(0, history.chat.length - exports.MAX_COMPACT_CHAT_MESSAGES);
    }
}
function appendNodeVisit(history, visit) {
    history.nodes.push(visit);
    if (history.nodes.length > exports.MAX_NODE_PATH) {
        history.nodes.splice(0, history.nodes.length - exports.MAX_NODE_PATH);
    }
}
function countNodeVisits(history, nodeId) {
    return history.nodes.filter((n) => n.nodeId === nodeId).length;
}
function lastVisitedNodeId(history) {
    return history.nodes.length
        ? history.nodes[history.nodes.length - 1].nodeId
        : null;
}
//# sourceMappingURL=conversation-history.js.map