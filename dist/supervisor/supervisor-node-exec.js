"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeNodeWithCatch = executeNodeWithCatch;
exports.stampListenTimeout = stampListenTimeout;
exports.enterPortal = enterPortal;
exports.enterNormal = enterNormal;
exports.stampPendingToolNode = stampPendingToolNode;
const conversation_history_1 = require("../conversation/conversation-history");
const listen_expectation_1 = require("../conversation/listen-expectation");
const listen_timeout_1 = require("../conversation/listen-timeout");
const channel_tools_1 = require("../channel/channel-tools");
const conversation_console_1 = require("../events/conversation-console");
const route_forensics_1 = require("../events/route-forensics");
const supervisor_types_1 = require("./supervisor.types");
async function executeNodeWithCatch(input) {
    const { runtime, output, node, candidate, intentionName, ctx, restarts, } = input;
    // Register listen BEFORE speech so mid-talk interrupts still bind here.
    const listenExpectation = await node.listen(ctx);
    runtime.listenExpectation = listenExpectation;
    this.stampListenTimeout(runtime, node);
    if (listenExpectation) {
        this.events.log('info', 'LISTEN_REGISTERED', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            nodeId: candidate.id,
            class: candidate.class,
            listen: runtime.listenExpectation,
            restart: restarts,
        });
    }
    this.events.log('info', 'NODE_ENTER', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        nodeId: candidate.id,
        class: candidate.class,
        intention: intentionName,
        portal: Boolean(candidate.portal),
        originNodeId: runtime.portalState.originNodeId,
        normalFlowNodeId: runtime.normalFlowNodeId,
        activePortalId: runtime.portalState.activePortalId,
        restart: restarts,
        turnNumber: runtime.turn.turnNumber,
        memory: (0, conversation_console_1.snapshotUserMemory)(runtime.memory),
    });
    if (restarts === 0) {
        (0, conversation_history_1.appendNodeVisit)(runtime.history, {
            nodeId: candidate.id,
            intention: intentionName,
            turnNumber: runtime.turn.turnNumber,
            at: new Date().toISOString(),
        });
    }
    try {
        const result = await node.run(ctx);
        if (result.kind === 'sayAndListen') {
            runtime.listenExpectation = (0, listen_expectation_1.mergeSayAndListenOptions)(runtime.listenExpectation, result.sayAndListen);
            this.stampListenTimeout(runtime, node, result.sayAndListen?.timeoutSeconds);
            if (result.sayAndListen?.extract?.fields?.length) {
                this.events.log('info', 'LISTEN_EXTRACT_REGISTERED', {
                    conversationId: runtime.conversationId,
                    runtimeInstanceId: runtime.runtimeInstanceId,
                    nodeId: candidate.id,
                    fields: result.sayAndListen.extract.fields,
                    hasOnExtracted: Boolean(result.sayAndListen.extract.onExtracted),
                });
            }
        }
        await node.after(ctx, result);
        this.events.log('info', 'NODE_AFTER', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            providerCallId: runtime.providerCallId,
            nodeId: candidate.id,
            class: candidate.class,
            intention: intentionName,
            resultKind: result.kind,
            resultDetail: (0, route_forensics_1.nodeResultForensics)(result),
            turnNumber: runtime.turn.turnNumber,
            memory: (0, conversation_console_1.snapshotUserMemory)(runtime.memory),
            actions: (0, route_forensics_1.actionForensics)(output.actions),
        });
        return { kind: 'done', result };
    }
    catch (error) {
        const directive = await node.catch(ctx, error);
        this.events.log('warn', 'NODE_CATCH', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            nodeId: candidate.id,
            class: candidate.class,
            error: error instanceof Error
                ? { name: error.name, message: error.message }
                : { message: String(error) },
            directive,
            restart: restarts,
        });
        if (directive.kind === 'restartNode') {
            if (restarts >= supervisor_types_1.MAX_NODE_RESTARTS) {
                throw new Error(`restartNode limit (${supervisor_types_1.MAX_NODE_RESTARTS}) exceeded for ${candidate.id}`);
            }
            // Drop partial speech from the failed attempt before retrying.
            output.actions.length = 0;
            return this.executeNodeWithCatch({
                ...input,
                restarts: restarts + 1,
            });
        }
        if (directive.kind === 'forceIntention') {
            output.actions.length = 0;
            return { kind: 'forceIntention', intention: directive.intention };
        }
        if (directive.kind === 'result') {
            await node.after(ctx, directive.result);
            return { kind: 'done', result: directive.result };
        }
        throw error;
    }
}
/**
 * Stamp the resolved listen window onto the active expectation.
 * sayAndListen timeout > listen() timeout > Node.listenTimeoutSeconds > default.
 */
function stampListenTimeout(runtime, node, fromSayAndListen) {
    const timeoutSeconds = (0, listen_timeout_1.resolveListenTimeoutSeconds)({
        fromSayAndListen,
        fromListen: runtime.listenExpectation?.timeoutSeconds,
        fromNode: node.listenTimeoutSeconds,
    });
    if (!runtime.listenExpectation) {
        runtime.listenExpectation = {
            intentions: [],
            timeoutSeconds,
            interruptible: node.interruptible,
        };
        return;
    }
    runtime.listenExpectation.timeoutSeconds = timeoutSeconds;
    if (runtime.listenExpectation.interruptible === undefined) {
        runtime.listenExpectation.interruptible = node.interruptible;
    }
}
function enterPortal(runtime, candidate) {
    const switching = runtime.portalState.activePortalId &&
        runtime.portalState.activePortalId !== candidate.id;
    if (switching) {
        const restored = runtime.exitPortal();
        this.events.log('info', 'PORTAL_EXIT', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            restoredOriginNodeId: restored,
            reason: 'switch_portal',
        });
    }
    const alreadyInSame = runtime.portalState.activePortalId === candidate.id;
    runtime.enterPortal(candidate.id);
    this.events.log('info', alreadyInSame ? 'PORTAL_REENTER' : 'PORTAL_ENTER', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        portalId: candidate.id,
        originNodeId: runtime.portalState.originNodeId,
    });
    return undefined;
}
function enterNormal(runtime, candidate) {
    let restored;
    if (runtime.portalState.activePortalId) {
        restored = runtime.exitPortal();
        this.events.log('info', 'PORTAL_EXIT', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            restoredOriginNodeId: restored,
            nextNodeId: candidate.id,
            reason: 'normal_intention',
        });
    }
    runtime.enterNormalNode(candidate.id);
    return restored;
}
/**
 * After a toolCall terminal action, remember which Node requested it so the
 * next Custom LLM turn with role:tool can re-enter without Brain scan.
 */
/**
 * After a toolCall terminal action, remember which Node requested it so the
 * next Custom LLM turn with role:tool can re-enter without Brain scan.
 */
function stampPendingToolNode(runtime, result, selectedNodeId) {
    if (result.kind === 'toolCall') {
        runtime.metadata[channel_tools_1.CHANNEL_META.pendingToolNodeId] = selectedNodeId;
        return;
    }
    // Non-tool terminals clear the pending marker.
    if (result.kind === 'sayAndListen' ||
        result.kind === 'endCall' ||
        result.kind === 'transferToHuman' ||
        result.kind === 'handoff' ||
        result.kind === 'continueTo') {
        delete runtime.metadata[channel_tools_1.CHANNEL_META.pendingToolNodeId];
    }
}
//# sourceMappingURL=supervisor-node-exec.js.map