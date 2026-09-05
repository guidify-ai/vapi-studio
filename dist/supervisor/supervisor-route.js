"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeIntentions = routeIntentions;
exports.resolveViaForWinner = resolveViaForWinner;
exports.emitRouteDecision = emitRouteDecision;
const conversation_history_1 = require("../conversation/conversation-history");
const standard_intentions_1 = require("../intentions/standard-intentions");
const route_forensics_1 = require("../events/route-forensics");
const conversation_console_1 = require("../events/conversation-console");
const code_intention_1 = require("../intention/code-intention");
const flow_loader_1 = require("../flow/flow-loader");
const agent_node_1 = require("../node/agent-node");
const supervisor_types_1 = require("./supervisor.types");
async function routeIntentions(input) {
    const { runtime, userText, output, ranked, forceHop, resolvedVia, confidenceThreshold, activeListen, allowMiss, } = input;
    const rejected = [];
    for (const scored of ranked) {
        const intentionName = scored.name;
        const nodeCandidates = this.flowLoader.nodesForIntention(intentionName);
        for (const candidate of nodeCandidates) {
            const node = this.nodes.get(candidate.class);
            if (!node) {
                rejected.push({
                    nodeId: candidate.id,
                    class: candidate.class,
                    intention: intentionName,
                    reason: 'missing',
                    confidence: scored.confidence,
                    priority: scored.priority,
                });
                this.events.log('warn', 'NODE_MISSING', {
                    class: candidate.class,
                    intention: intentionName,
                });
                continue;
            }
            // Idle still-there is forceIntention-only (channel timer). Do not let Brain
            // promote “hey?” / filler into the still-there portal mid-flow.
            if (intentionName === standard_intentions_1.STANDARD_INTENTIONS.isStillThere &&
                runtime.portalState.activePortalId !== 'stillThere' &&
                resolvedVia !== code_intention_1.ROUTE_RESOLVED_VIA.ForceIntention) {
                rejected.push({
                    nodeId: candidate.id,
                    class: candidate.class,
                    intention: intentionName,
                    reason: 'still_there_requires_force',
                    confidence: scored.confidence,
                    priority: scored.priority,
                });
                this.events.log('info', 'NODE_REJECT', {
                    conversationId: runtime.conversationId,
                    runtimeInstanceId: runtime.runtimeInstanceId,
                    nodeId: candidate.id,
                    class: candidate.class,
                    intention: intentionName,
                    confidence: scored.confidence,
                    priority: scored.priority,
                    reason: 'still_there_requires_force',
                });
                continue;
            }
            const ctx = (0, agent_node_1.nodeContextFromRuntime)({
                runtime,
                userText,
                output,
                events: this.events,
                brain: this.brain,
                integrations: this.integrations,
                forms: this.forms,
                intention: intentionName,
            });
            const can = await node.before(ctx);
            if (!can) {
                rejected.push({
                    nodeId: candidate.id,
                    class: candidate.class,
                    intention: intentionName,
                    reason: 'before_false',
                    confidence: scored.confidence,
                    priority: scored.priority,
                });
                this.events.log('info', 'NODE_REJECT', {
                    conversationId: runtime.conversationId,
                    runtimeInstanceId: runtime.runtimeInstanceId,
                    nodeId: candidate.id,
                    class: candidate.class,
                    intention: intentionName,
                    confidence: scored.confidence,
                    priority: scored.priority,
                    reason: 'before_false',
                });
                continue;
            }
            const winner = {
                nodeId: candidate.id,
                class: candidate.class,
                intention: intentionName,
                confidence: scored.confidence,
                priority: scored.priority,
                portal: Boolean(candidate.portal),
            };
            // isContinue: never speak “Okay, continuing.” — restore portal origin and
            // re-route the same utterance against that node’s listen. Only when a
            // portal is active; otherwise let ContinueNode.run (e.g. catch recovery).
            if (this.isContinueNode(candidate) &&
                runtime.portalState.activePortalId) {
                await this.emitRouteDecision({
                    runtime,
                    userText,
                    resolvedVia: resolvedVia ?? code_intention_1.ROUTE_RESOLVED_VIA.Continue,
                    confidenceThreshold,
                    activeListen,
                    ranked,
                    rejected,
                    winner: { ...winner, class: `${winner.class}→continue_replay` },
                });
                return this.replayOriginAfterContinue({
                    runtime,
                    userText,
                    output,
                    forceHop: forceHop + 1,
                    fromNodeId: candidate.id,
                });
            }
            // Still-there “yes / still here” → silent origin resume (same as Continue).
            if (this.isStillThereNode(candidate) &&
                runtime.portalState.activePortalId === candidate.id &&
                (intentionName === standard_intentions_1.STANDARD_INTENTIONS.isPositive ||
                    intentionName === 'isContinue')) {
                runtime.portalState.stillThere.attempts = 0;
                await this.emitRouteDecision({
                    runtime,
                    userText,
                    resolvedVia: resolvedVia ?? code_intention_1.ROUTE_RESOLVED_VIA.Continue,
                    confidenceThreshold,
                    activeListen,
                    ranked,
                    rejected,
                    winner: { ...winner, class: `${winner.class}→continue_replay` },
                });
                return this.replayOriginAfterContinue({
                    runtime,
                    userText,
                    output,
                    forceHop: forceHop + 1,
                    fromNodeId: candidate.id,
                    resolvedVia: code_intention_1.ROUTE_RESOLVED_VIA.Continue,
                });
            }
            await this.emitRouteDecision({
                runtime,
                userText,
                resolvedVia: this.resolveViaForWinner(resolvedVia, intentionName, forceHop),
                confidenceThreshold,
                activeListen,
                ranked,
                rejected,
                winner,
            });
            let portalOriginRestored;
            if (candidate.portal) {
                portalOriginRestored = this.enterPortal(runtime, candidate);
            }
            else {
                portalOriginRestored = this.enterNormal(runtime, candidate);
            }
            const executed = await this.executeNodeWithCatch({
                runtime,
                userText,
                output,
                node,
                candidate,
                intentionName,
                ctx,
                restarts: 0,
                forceHop,
            });
            if (executed.kind === 'forceIntention') {
                if (forceHop >= supervisor_types_1.MAX_FORCE_INTENTION_HOPS) {
                    throw new Error(`forceIntention hop limit (${supervisor_types_1.MAX_FORCE_INTENTION_HOPS}) exceeded`);
                }
                this.events.log('info', 'CATCH_FORCE_INTENTION', {
                    conversationId: runtime.conversationId,
                    runtimeInstanceId: runtime.runtimeInstanceId,
                    fromNodeId: candidate.id,
                    intention: executed.intention,
                    forceHop: forceHop + 1,
                });
                return this.routeIntentions({
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
                    forceHop: forceHop + 1,
                    resolvedVia: code_intention_1.ROUTE_RESOLVED_VIA.ForceIntention,
                    confidenceThreshold,
                    activeListen: runtime.listenExpectation,
                });
            }
            return {
                selectedNodeId: candidate.id,
                selectedClass: candidate.class,
                result: executed.result,
                portalOriginRestored,
            };
        }
    }
    await this.emitRouteDecision({
        runtime,
        userText,
        resolvedVia: resolvedVia ?? code_intention_1.ROUTE_RESOLVED_VIA.Brain,
        confidenceThreshold,
        activeListen,
        ranked,
        rejected,
        winner: null,
        failed: true,
    });
    if (allowMiss) {
        return null;
    }
    // Brain/listen picked something every Node refused (before_false) — never 500
    // the channel. Recover through the unknown-transition portal once.
    if (resolvedVia !== code_intention_1.ROUTE_RESOLVED_VIA.RouteFallbackUnknown &&
        forceHop < supervisor_types_1.MAX_FORCE_INTENTION_HOPS) {
        this.events.log('warn', 'ROUTE_FALLBACK_UNKNOWN', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            turnNumber: runtime.turn.turnNumber,
            userText,
            rejected,
            note: 'all candidates before() false — falling back to studio.isUnknownTransition',
        });
        return this.routeIntentions({
            runtime,
            userText,
            output,
            ranked: [
                {
                    name: standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition,
                    confidence: 1,
                    priority: 0,
                    rank: 0,
                },
            ],
            forceHop: forceHop + 1,
            resolvedVia: code_intention_1.ROUTE_RESOLVED_VIA.RouteFallbackUnknown,
            confidenceThreshold,
            activeListen,
        });
    }
    throw new Error('Supervisor could not route turn to any eligible node');
}
function resolveViaForWinner(resolvedVia, intentionName, forceHop) {
    if (resolvedVia === code_intention_1.ROUTE_RESOLVED_VIA.ConditionForce) {
        return code_intention_1.ROUTE_RESOLVED_VIA.ConditionForce;
    }
    if (resolvedVia === code_intention_1.ROUTE_RESOLVED_VIA.IntentionForce) {
        return code_intention_1.ROUTE_RESOLVED_VIA.IntentionForce;
    }
    if (resolvedVia === code_intention_1.ROUTE_RESOLVED_VIA.IntentionMatch) {
        return code_intention_1.ROUTE_RESOLVED_VIA.IntentionMatch;
    }
    if (intentionName.startsWith(flow_loader_1.CONDITION_GOTO_PREFIX)) {
        return code_intention_1.ROUTE_RESOLVED_VIA.ConditionBoost;
    }
    return (resolvedVia ??
        (forceHop > 0
            ? code_intention_1.ROUTE_RESOLVED_VIA.ForceIntention
            : code_intention_1.ROUTE_RESOLVED_VIA.Brain));
}
/** Durable + console forensic: why this node won (or none did). */
/** Durable + console forensic: why this node won (or none did). */
async function emitRouteDecision(input) {
    const { runtime, userText, resolvedVia, confidenceThreshold, activeListen, ranked, rejected, winner, failed, } = input;
    const type = failed ? 'ROUTE_FAILED' : 'ROUTE_DECISION';
    const payload = {
        runtimeInstanceId: runtime.runtimeInstanceId,
        providerCallId: runtime.providerCallId,
        turnNumber: runtime.turn.turnNumber,
        userText,
        resolvedVia,
        confidenceThreshold: confidenceThreshold ?? null,
        listen: (0, route_forensics_1.listenForensics)(activeListen),
        walk: (0, route_forensics_1.walkForensics)(ranked),
        rejected,
        winner,
        activePortalId: runtime.portalState.activePortalId ?? null,
        originNodeId: runtime.portalState.originNodeId ?? null,
        normalFlowNodeId: runtime.normalFlowNodeId ?? null,
        currentNodeId: runtime.currentNodeId ?? null,
        memory: (0, conversation_console_1.snapshotUserMemory)(runtime.memory),
    };
    if (runtime.conversationId) {
        await this.events.persist(runtime.conversationId, type, payload);
    }
    else {
        this.events.log(failed ? 'error' : 'info', type, payload);
    }
}
//# sourceMappingURL=supervisor-route.js.map