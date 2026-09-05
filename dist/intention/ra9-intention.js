"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RA9_INTENTION_REGISTRY = exports.Ra9Intention = exports.DEFAULT_FORCE_INTENTION_PRIORITY = exports.ROUTE_RESOLVED_VIA = exports.INTENTION_RUN_KIND = exports.INTENTION_CASCADE_PHASE = void 0;
exports.intentionContextFromRuntime = intentionContextFromRuntime;
const conversation_history_1 = require("../conversation/conversation-history");
const intention_constants_1 = require("./intention-constants");
var intention_constants_2 = require("./intention-constants");
Object.defineProperty(exports, "INTENTION_CASCADE_PHASE", { enumerable: true, get: function () { return intention_constants_2.INTENTION_CASCADE_PHASE; } });
Object.defineProperty(exports, "INTENTION_RUN_KIND", { enumerable: true, get: function () { return intention_constants_2.INTENTION_RUN_KIND; } });
Object.defineProperty(exports, "ROUTE_RESOLVED_VIA", { enumerable: true, get: function () { return intention_constants_2.ROUTE_RESOLVED_VIA; } });
Object.defineProperty(exports, "DEFAULT_FORCE_INTENTION_PRIORITY", { enumerable: true, get: function () { return intention_constants_2.DEFAULT_FORCE_INTENTION_PRIORITY; } });
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
class Ra9Intention {
    /**
     * Cascade phase. Default `scan` preserves today’s string-only intentions.
     * Set `force` for Brain-free gates (phone missing, consent gap, …).
     */
    phase = intention_constants_1.INTENTION_CASCADE_PHASE.Scan;
    /** Brain scoring hint (listen/Brain). Does not by itself change walk order. */
    boost = 0;
    /** Supervisor walk priority when this intention is ranked (default 1). */
    priority = 1;
    /**
     * Optional hard destination when force/match wins.
     * Overridden if `run()` returns `{ kind: INTENTION_RUN_KIND.Goto, nodeId }`.
     */
    toNodeId;
    /** Forensic / diagram label (optional). */
    reason;
    async before(_ctx) {
        return true;
    }
    /**
     * Local confidence in `[0, 1]`, or `null` to leave scoring to Brain / listen.
     * Force phase defaults to `1` when `before()` passed and this is not overridden.
     */
    async match(_ctx) {
        return this.phase === intention_constants_1.INTENTION_CASCADE_PHASE.Force ? 1 : null;
    }
    async run(_ctx) {
        if (this.toNodeId) {
            return {
                kind: intention_constants_1.INTENTION_RUN_KIND.Goto,
                nodeId: this.toNodeId,
                reason: this.reason,
            };
        }
        return null;
    }
    async after(_ctx) {
        // no-op
    }
}
exports.Ra9Intention = Ra9Intention;
exports.RA9_INTENTION_REGISTRY = Symbol('RA9_INTENTION_REGISTRY');
function intentionContextFromRuntime(input) {
    const { runtime, userText, events } = input;
    const memory = runtime.memory;
    const variables = runtime.variables;
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
        visitCount: (nodeId) => (0, conversation_history_1.countNodeVisits)(runtime.history, nodeId),
        previousNodeId: (0, conversation_history_1.lastVisitedNodeId)(runtime.history),
        listenIntentionNames: (runtime.listenExpectation?.intentions ?? []).map((i) => i.name),
    };
}
//# sourceMappingURL=ra9-intention.js.map