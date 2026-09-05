"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceConversationLimits = enforceConversationLimits;
const conversation_limits_1 = require("../conversation/conversation-limits");
const conversation_output_1 = require("../output/conversation-output");
async function enforceConversationLimits(input) {
    const limits = this.conversationLimits ?? (0, conversation_limits_1.resolveConversationLimits)();
    const check = (0, conversation_limits_1.evaluateConversationLimits)({
        turnNumber: input.runtime.turn.turnNumber,
        createdAt: input.runtime.createdAt,
        limits,
    });
    if (!check.exceeded)
        return null;
    const output = new conversation_output_1.BufferedConversationOutput(input.onSay);
    const result = await output.endCall(limits.endMessage);
    this.events.log('warn', 'CONVERSATION_LIMIT_EXCEEDED', {
        conversationId: input.runtime.conversationId,
        providerCallId: input.runtime.providerCallId,
        runtimeInstanceId: input.runtime.runtimeInstanceId,
        turnNumber: input.runtime.turn.turnNumber,
        reason: check.reason,
        elapsedMs: check.elapsedMs,
        maxTurns: limits.maxTurns,
        maxDurationMs: limits.maxDurationMs,
    });
    return {
        runtime: input.runtime,
        intentionNames: [],
        selectedNodeId: input.runtime.currentNodeId ?? 'conversation_limit',
        selectedClass: 'ConversationLimit',
        result,
        actions: output.actions,
    };
}
//# sourceMappingURL=supervisor-limits.js.map