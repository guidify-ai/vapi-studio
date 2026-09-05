"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateForLog = truncateForLog;
exports.listenForensics = listenForensics;
exports.walkForensics = walkForensics;
exports.nodeResultForensics = nodeResultForensics;
exports.actionForensics = actionForensics;
function truncateForLog(text, max = 200) {
    if (text == null)
        return undefined;
    const t = text.trim();
    if (!t)
        return undefined;
    return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}
function listenForensics(listen) {
    if (!listen)
        return null;
    const intentions = listen.intentions ?? [];
    return {
        intentions: intentions.map((i) => ({
            name: i.name,
            boost: i.boost,
            priority: i.priority,
        })),
        extractKeys: (listen.extract?.fields ?? []).map((f) => f.key),
        timeoutSeconds: listen.timeoutSeconds ?? null,
        hasResolveIntention: 'resolveIntention' in listen &&
            typeof listen.resolveIntention === 'function',
    };
}
function walkForensics(ranked) {
    return ranked.map((row) => {
        const payload = row.payload && typeof row.payload === 'object'
            ? row.payload
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
function nodeResultForensics(result) {
    const detail = { kind: result.kind };
    const text = truncateForLog(result.text);
    if (text)
        detail.text = text;
    if (result.continueToNodeId)
        detail.continueToNodeId = result.continueToNodeId;
    if (result.handoffReason)
        detail.reason = result.handoffReason;
    if (result.handoffTo)
        detail.handoffTo = result.handoffTo;
    if (result.destination)
        detail.destination = result.destination;
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
function actionForensics(actions) {
    return actions.map((a) => {
        const row = { kind: a.kind };
        const text = truncateForLog(a.text, 120);
        if (text)
            row.text = text;
        if (a.continueToNodeId)
            row.continueToNodeId = a.continueToNodeId;
        if (a.handoffReason)
            row.reason = a.handoffReason;
        if (a.handoffTo)
            row.handoffTo = a.handoffTo;
        return row;
    });
}
//# sourceMappingURL=route-forensics.js.map