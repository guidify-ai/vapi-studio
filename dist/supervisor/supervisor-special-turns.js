"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeModuleEntryTurn = executeModuleEntryTurn;
exports.executeOpeningTurn = executeOpeningTurn;
exports.executeToolResultTurn = executeToolResultTurn;
const conversation_history_1 = require("../conversation/conversation-history");
const channel_tools_1 = require("../channel/channel-tools");
const standard_intentions_1 = require("../intentions/standard-intentions");
const agent_node_1 = require("../node/agent-node");
const conversation_output_1 = require("../output/conversation-output");
const conversation_console_1 = require("../events/conversation-console");
/**
 * Speak the active module's current/entry Node after WORKFLOW_HANDOFF
 * (does not toggle openingCompleted).
 */
async function executeModuleEntryTurn(input) {
    const { runtime, userText, onSay } = input;
    const flow = this.flowLoader.getFlow();
    const entryId = runtime.currentNodeId ?? flow.start;
    const candidate = flow.nodes[entryId];
    if (!candidate) {
        throw new Error(`Module entry node "${entryId}" missing`);
    }
    const node = this.nodes.get(candidate.class);
    if (!node) {
        throw new Error(`Module entry class not registered: ${candidate.class}`);
    }
    const output = new conversation_output_1.BufferedConversationOutput(onSay);
    const ctx = (0, agent_node_1.nodeContextFromRuntime)({
        runtime,
        userText,
        output,
        events: this.events,
        brain: this.brain,
        integrations: this.integrations,
        forms: this.forms,
        intention: candidate.intentions[0] ?? 'studio.moduleEntry',
    });
    this.events.log('info', 'MODULE_ENTRY_TURN', {
        conversationId: runtime.conversationId,
        providerCallId: runtime.providerCallId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        entryNodeId: entryId,
        class: candidate.class,
        activeModuleId: runtime.metadata.activeModuleId ?? null,
        workflowId: runtime.metadata.workflowId ?? null,
        turnNumber: runtime.turn.turnNumber,
        memory: (0, conversation_console_1.snapshotUserMemory)(runtime.memory),
    });
    const can = await node.before(ctx);
    if (!can) {
        throw new Error(`Module entry node ${entryId} rejected before()`);
    }
    if (candidate.portal) {
        this.enterPortal(runtime, candidate);
    }
    else {
        this.enterNormal(runtime, candidate);
    }
    const executed = await this.executeNodeWithCatch({
        runtime,
        userText,
        output,
        node,
        candidate,
        intentionName: candidate.intentions[0] ?? 'studio.moduleEntry',
        ctx,
        restarts: 0,
        forceHop: 0,
    });
    if (executed.kind === 'forceIntention') {
        const routed = await this.routeIntentions({
            runtime,
            userText,
            output,
            ranked: [
                {
                    name: executed.intention,
                    confidence: 1,
                    priority: conversation_history_1.DEFAULT_INTENTION_PRIORITY,
                    rank: 0,
                },
            ],
            forceHop: 1,
        });
        return {
            runtime,
            intentionNames: ['studio.moduleEntry', executed.intention],
            selectedNodeId: routed.selectedNodeId,
            selectedClass: routed.selectedClass,
            result: routed.result,
            actions: output.actions,
            portalOriginRestored: routed.portalOriginRestored,
        };
    }
    return {
        runtime,
        intentionNames: ['studio.moduleEntry'],
        selectedNodeId: candidate.id,
        selectedClass: candidate.class,
        result: executed.result,
        actions: output.actions,
    };
}
/**
 * First Custom LLM turn: execute flow.start Node.run() so the assistant
 * speaks before any user utterance / Brain routing.
 */
/**
 * First Custom LLM turn: execute flow.start Node.run() so the assistant
 * speaks before any user utterance / Brain routing.
 */
async function executeOpeningTurn(input) {
    const { runtime, userText, onSay } = input;
    const flow = this.flowLoader.getFlow();
    const startId = flow.start;
    const candidate = flow.nodes[startId];
    if (!candidate) {
        throw new Error(`Flow start node "${startId}" missing`);
    }
    const node = this.nodes.get(candidate.class);
    if (!node) {
        throw new Error(`Start node class not registered: ${candidate.class}`);
    }
    const output = new conversation_output_1.BufferedConversationOutput(onSay);
    const ctx = (0, agent_node_1.nodeContextFromRuntime)({
        runtime,
        userText,
        output,
        events: this.events,
        brain: this.brain,
        integrations: this.integrations,
        forms: this.forms,
        intention: candidate.intentions[0] ?? 'studio.opening',
    });
    this.events.log('info', 'OPENING_TURN', {
        conversationId: runtime.conversationId,
        providerCallId: runtime.providerCallId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        startNodeId: startId,
        class: candidate.class,
        userText,
        turnNumber: runtime.turn.turnNumber,
        memory: (0, conversation_console_1.snapshotUserMemory)(runtime.memory),
    });
    const can = await node.before(ctx);
    if (!can) {
        throw new Error(`Opening start node ${startId} rejected before()`);
    }
    if (candidate.portal) {
        this.enterPortal(runtime, candidate);
    }
    else {
        this.enterNormal(runtime, candidate);
    }
    const executed = await this.executeNodeWithCatch({
        runtime,
        userText,
        output,
        node,
        candidate,
        intentionName: candidate.intentions[0] ?? 'studio.opening',
        ctx,
        restarts: 0,
        forceHop: 0,
    });
    if (executed.kind === 'forceIntention') {
        runtime.openingCompleted = true;
        this.events.log('info', 'OPENING_FORCE_INTENTION', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            intention: executed.intention,
        });
        const routed = await this.routeIntentions({
            runtime,
            userText,
            output,
            ranked: [
                {
                    name: executed.intention,
                    confidence: 1,
                    priority: conversation_history_1.DEFAULT_INTENTION_PRIORITY,
                    rank: 0,
                },
            ],
            forceHop: 1,
        });
        return {
            runtime,
            intentionNames: ['studio.opening', executed.intention],
            selectedNodeId: routed.selectedNodeId,
            selectedClass: routed.selectedClass,
            result: routed.result,
            actions: output.actions,
            portalOriginRestored: routed.portalOriginRestored,
        };
    }
    runtime.openingCompleted = true;
    return {
        runtime,
        intentionNames: ['studio.opening'],
        selectedNodeId: candidate.id,
        selectedClass: candidate.class,
        result: executed.result,
        actions: output.actions,
    };
}
/**
 * Tool-result-only Custom LLM turn — re-run the Node that emitted toolCall.
 */
async function executeToolResultTurn(input) {
    const { runtime, userText, onSay } = input;
    const flow = this.flowLoader.getFlow();
    const pendingId = typeof runtime.metadata[channel_tools_1.CHANNEL_META.pendingToolNodeId] === 'string'
        ? String(runtime.metadata[channel_tools_1.CHANNEL_META.pendingToolNodeId])
        : null;
    const entryId = pendingId ||
        runtime.currentNodeId ||
        runtime.normalFlowNodeId ||
        flow.start;
    const candidate = flow.nodes[entryId];
    if (!candidate) {
        throw new Error(`Tool-result node "${entryId}" missing`);
    }
    const node = this.nodes.get(candidate.class);
    if (!node) {
        throw new Error(`Tool-result class not registered: ${candidate.class}`);
    }
    const output = new conversation_output_1.BufferedConversationOutput(onSay);
    const ctx = (0, agent_node_1.nodeContextFromRuntime)({
        runtime,
        userText,
        output,
        events: this.events,
        brain: this.brain,
        integrations: this.integrations,
        forms: this.forms,
        intention: standard_intentions_1.STANDARD_INTENTIONS.isToolResult,
    });
    this.events.log('info', 'TOOL_RESULT_TURN', {
        conversationId: runtime.conversationId,
        providerCallId: runtime.providerCallId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        entryNodeId: entryId,
        class: candidate.class,
        turnNumber: runtime.turn.turnNumber,
    });
    const can = await node.before(ctx);
    if (!can) {
        throw new Error(`Tool-result node ${entryId} rejected before()`);
    }
    if (candidate.portal) {
        this.enterPortal(runtime, candidate);
    }
    else {
        this.enterNormal(runtime, candidate);
    }
    const executed = await this.executeNodeWithCatch({
        runtime,
        userText,
        output,
        node,
        candidate,
        intentionName: standard_intentions_1.STANDARD_INTENTIONS.isToolResult,
        ctx,
        restarts: 0,
        forceHop: 0,
    });
    if (executed.kind === 'forceIntention') {
        const routed = await this.routeIntentions({
            runtime,
            userText,
            output,
            ranked: [
                {
                    name: executed.intention,
                    confidence: 1,
                    priority: conversation_history_1.DEFAULT_INTENTION_PRIORITY,
                    rank: 0,
                },
            ],
            forceHop: 1,
        });
        this.stampPendingToolNode(runtime, routed.result, routed.selectedNodeId);
        return {
            runtime,
            intentionNames: [standard_intentions_1.STANDARD_INTENTIONS.isToolResult, executed.intention],
            selectedNodeId: routed.selectedNodeId,
            selectedClass: routed.selectedClass,
            result: routed.result,
            actions: output.actions,
            portalOriginRestored: routed.portalOriginRestored,
        };
    }
    this.stampPendingToolNode(runtime, executed.result, candidate.id);
    return {
        runtime,
        intentionNames: [standard_intentions_1.STANDARD_INTENTIONS.isToolResult],
        selectedNodeId: candidate.id,
        selectedClass: candidate.class,
        result: executed.result,
        actions: output.actions,
    };
}
//# sourceMappingURL=supervisor-special-turns.js.map