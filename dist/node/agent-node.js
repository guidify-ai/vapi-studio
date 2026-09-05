"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STUDIO_NODE_REGISTRY = exports.AgentNode = void 0;
exports.conversationViewFromRuntime = conversationViewFromRuntime;
exports.nodeContextFromRuntime = nodeContextFromRuntime;
const conversation_history_1 = require("../conversation/conversation-history");
const catch_directive_1 = require("./catch-directive");
const listen_timeout_1 = require("../conversation/listen-timeout");
const channel_tools_1 = require("../channel/channel-tools");
/**
 * Node lifecycle (per turn selection) — declare overrides in this order:
 *   before()  → authorize / prepare (return false to reject)
 *   listen()  → register listen expectation before speech
 *   run()     → execute
 *   after()   → teardown for this Node execution
 *   catch()   → recover from FlowUncertainError / other errors
 */
class AgentNode {
    /**
     * Seconds the channel waits after a user pause before closing this Node's
     * listen. Override on the subclass. `listen()` / `sayAndListen({ timeoutSeconds })`
     * can still override per turn.
     */
    listenTimeoutSeconds = listen_timeout_1.DEFAULT_LISTEN_TIMEOUT_SECONDS;
    /**
     * When false, the next listen is not barge-in: Custom LLM overlap is queued
     * until `listenTimeoutSeconds` of silence after the last fragment.
     */
    interruptible = true;
    async before(_ctx) {
        return true;
    }
    async listen(_ctx) {
        return null;
    }
    async after(_ctx, _result) {
        // no-op
    }
    /**
     * Handle errors thrown from run() (e.g. FlowUncertainError).
     * Return restartNode() / forceIntention(...) / catchResult(...) / rethrowCatch().
     * Default: rethrow.
     */
    async catch(_ctx, _error) {
        return (0, catch_directive_1.rethrowCatch)();
    }
}
exports.AgentNode = AgentNode;
exports.STUDIO_NODE_REGISTRY = Symbol('STUDIO_NODE_REGISTRY');
function conversationViewFromRuntime(runtime) {
    return {
        id: runtime.conversationId,
        providerCallId: runtime.providerCallId,
        flowId: runtime.flowId,
        variables: runtime.variables,
        memory: runtime.memory,
    };
}
function nodeContextFromRuntime(input) {
    const conversation = conversationViewFromRuntime(input.runtime);
    const history = input.runtime.history;
    const integrations = input.integrations;
    const forms = input.forms;
    const meta = input.runtime.metadata;
    const toolsRaw = meta[channel_tools_1.CHANNEL_META.tools];
    const toolsList = Array.isArray(toolsRaw)
        ? toolsRaw
        : [];
    const tools = (0, channel_tools_1.channelToolsApiFromList)(toolsList);
    const resultsRaw = meta[channel_tools_1.CHANNEL_META.toolResults];
    const toolResultsList = Array.isArray(resultsRaw)
        ? resultsRaw
        : [];
    const vapiRaw = meta[channel_tools_1.CHANNEL_META.vapi];
    const vapi = vapiRaw && typeof vapiRaw === 'object'
        ? vapiRaw
        : {
            callId: input.runtime.providerCallId ?? null,
        };
    return {
        runtime: input.runtime,
        conversation,
        userText: input.userText,
        output: input.output,
        events: input.events,
        memory: conversation.memory,
        intention: input.intention ?? null,
        history,
        visitCount: (nodeId) => (0, conversation_history_1.countNodeVisits)(history, nodeId),
        previousNodeId: (0, conversation_history_1.lastVisitedNodeId)(history),
        clarify: (request) => input.brain.clarify({
            ...request,
            meta: {
                providerCallId: input.runtime.providerCallId,
                conversationId: input.runtime.conversationId,
                ...request.meta,
            },
        }),
        judge: (request) => input.brain.judge({
            ...request,
            meta: {
                providerCallId: input.runtime.providerCallId,
                conversationId: input.runtime.conversationId,
                ...request.meta,
            },
        }),
        integrations: {
            request: (request) => {
                if (!integrations) {
                    throw new Error('IntegrationClient is not wired on this NodeContext');
                }
                return integrations.request({
                    ...request,
                    meta: {
                        conversationId: input.runtime.conversationId,
                        runtimeInstanceId: input.runtime.runtimeInstanceId,
                        providerCallId: input.runtime.providerCallId,
                        ...request.meta,
                    },
                });
            },
        },
        forms: {
            expose: (spec) => {
                if (!forms) {
                    throw new Error('FormsService is not wired on this NodeContext');
                }
                return forms.expose(input.runtime.conversationId, spec);
            },
            open: (spec) => {
                if (!forms) {
                    throw new Error('FormsService is not wired on this NodeContext');
                }
                return forms.open(input.runtime.conversationId, spec);
            },
            resend: () => {
                if (!forms) {
                    throw new Error('FormsService is not wired on this NodeContext');
                }
                return forms.resend(input.runtime.conversationId);
            },
            claimSubmitted: () => {
                if (!forms)
                    return null;
                return forms.claimSubmitted(input.runtime.conversationId);
            },
            hasPending: () => {
                if (!forms)
                    return false;
                return forms.getPending(input.runtime.conversationId) != null;
            },
            hasUnclaimedSubmit: () => {
                if (!forms)
                    return false;
                return forms.hasUnclaimedSubmit(input.runtime.conversationId);
            },
        },
        tools,
        toolResults: () => toolResultsList,
        toolResult: (nameOrId) => {
            const key = nameOrId.trim();
            return (toolResultsList.find((r) => r.name === key || r.toolCallId === key) ?? undefined);
        },
        vapi,
    };
}
//# sourceMappingURL=agent-node.js.map