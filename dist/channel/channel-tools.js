"use strict";
/**
 * Optional tool ads from the channel (e.g. Vapi Custom LLM `body.tools`).
 *
 * Convention: Vapi Studio requests tools **by name** assuming the Vapi assistant was
 * pre-provisioned with them. This snapshot is visibility for operators / soft
 * warnings — not a required inventory gate, and not shared sync state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHANNEL_META = void 0;
exports.extractAdvertisedTools = extractAdvertisedTools;
exports.channelToolsApiFromList = channelToolsApiFromList;
exports.extractToolResults = extractToolResults;
/** Normalize Vapi/OpenAI tool advertisements into a flat list. */
function extractAdvertisedTools(tools) {
    if (!Array.isArray(tools))
        return [];
    const out = [];
    const seen = new Set();
    for (const tool of tools) {
        if (!tool || typeof tool !== 'object')
            continue;
        const t = tool;
        const fn = t.function && typeof t.function === 'object' ? t.function : null;
        const name = (fn && typeof fn.name === 'string' ? fn.name.trim() : '') ||
            (typeof t.name === 'string' ? t.name.trim() : '') ||
            (typeof t.type === 'string' &&
                ['endCall', 'transferCall', 'handoff'].includes(t.type)
                ? t.type
                : '');
        if (!name || seen.has(name))
            continue;
        seen.add(name);
        out.push({
            name,
            description: (fn && typeof fn.description === 'string' ? fn.description : undefined) ??
                (typeof t.description === 'string' ? t.description : undefined),
            parameters: (fn && fn.parameters && typeof fn.parameters === 'object'
                ? fn.parameters
                : undefined) ??
                (t.parameters && typeof t.parameters === 'object'
                    ? t.parameters
                    : undefined),
            type: typeof t.type === 'string' ? t.type : undefined,
        });
    }
    return out;
}
function channelToolsApiFromList(tools) {
    const byName = new Map(tools.map((t) => [t.name, t]));
    return {
        list: () => [...tools],
        has: (name) => byName.has(name.trim()),
        get: (name) => byName.get(name.trim()),
    };
}
function contentToString(content) {
    if (typeof content === 'string')
        return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => typeof part === 'object' && part && 'text' in part
            ? String(part.text)
            : '')
            .join(' ')
            .trim();
    }
    if (content == null)
        return '';
    try {
        return JSON.stringify(content);
    }
    catch {
        return String(content);
    }
}
function tryParseJson(text) {
    const t = text.trim();
    if (!t)
        return undefined;
    try {
        return JSON.parse(t);
    }
    catch {
        return undefined;
    }
}
/**
 * Collect `role:tool` messages from the newest Custom LLM request,
 * pairing names from prior assistant `tool_calls` when possible.
 */
function extractToolResults(body) {
    const messages = body.messages ?? [];
    const nameByCallId = new Map();
    for (const msg of messages) {
        if (msg.role !== 'assistant' || !Array.isArray(msg.tool_calls))
            continue;
        for (const tc of msg.tool_calls) {
            const id = typeof tc.id === 'string' ? tc.id : '';
            const name = tc.function && typeof tc.function.name === 'string'
                ? tc.function.name
                : '';
            if (id && name)
                nameByCallId.set(id, name);
        }
    }
    const results = [];
    for (const msg of messages) {
        if (msg.role !== 'tool')
            continue;
        const content = contentToString(msg.content);
        const toolCallId = typeof msg.tool_call_id === 'string' ? msg.tool_call_id : undefined;
        const name = (typeof msg.name === 'string' && msg.name) ||
            (toolCallId ? nameByCallId.get(toolCallId) : undefined);
        results.push({
            toolCallId,
            name,
            content,
            parsed: tryParseJson(content),
        });
    }
    return results;
}
/** Metadata keys stashed on SupervisedConversation.metadata each Custom LLM turn. */
exports.CHANNEL_META = {
    tools: 'channelTools',
    toolResults: 'lastToolResults',
    vapi: 'vapi',
    pendingToolNodeId: 'pendingToolCallNodeId',
};
//# sourceMappingURL=channel-tools.js.map