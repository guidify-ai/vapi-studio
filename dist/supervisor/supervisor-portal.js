"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isContinueNode = isContinueNode;
exports.isStillThereNode = isStillThereNode;
exports.isUnknownPortalActive = isUnknownPortalActive;
exports.tryUnknownOriginConsume = tryUnknownOriginConsume;
exports.resolveOriginListenForReplay = resolveOriginListenForReplay;
exports.replayOriginAfterContinue = replayOriginAfterContinue;
const listen_expectation_1 = require("../conversation/listen-expectation");
const brain_ranking_1 = require("../brain/brain-ranking");
const standard_intentions_1 = require("../intentions/standard-intentions");
const agent_node_1 = require("../node/agent-node");
const code_intention_1 = require("../intention/code-intention");
const supervisor_types_1 = require("./supervisor.types");
/** Continue / isContinue is an escape hatch back to the pre-portal node. */
function isContinueNode(candidate) {
    return (candidate.class === 'ContinueNode' ||
        candidate.id === 'continue' ||
        (candidate.intentions.length === 1 &&
            candidate.intentions[0] === 'isContinue'));
}
function isStillThereNode(candidate) {
    return (candidate.class === 'StillThereNode' ||
        candidate.id === 'stillThere' ||
        candidate.intentions.includes(standard_intentions_1.STANDARD_INTENTIONS.isStillThere));
}
/** True when the active portal owns `studio.isUnknownTransition`. */
/** True when the active portal owns `studio.isUnknownTransition`. */
function isUnknownPortalActive(runtime) {
    const portalId = runtime.portalState.activePortalId;
    if (!portalId)
        return false;
    const def = this.flowLoader.getFlow().nodes[portalId];
    if (!def?.portal)
        return false;
    return def.intentions.includes(standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition);
}
/**
 * While in unknown recovery, try the origin’s listen (snapshot or refresh).
 * If the utterance resolves / ranks as a non-unknown product (or portal)
 * intention, exit the portal and route that intention on this turn — do not
 * re-scan against unknown’s thin candidate list.
 */
/**
 * While in unknown recovery, try the origin’s listen (snapshot or refresh).
 * If the utterance resolves / ranks as a non-unknown product (or portal)
 * intention, exit the portal and route that intention on this turn — do not
 * re-scan against unknown’s thin candidate list.
 */
async function tryUnknownOriginConsume(input) {
    const { runtime, userText, output, forceHop } = input;
    const portalId = runtime.portalState.activePortalId;
    const originId = runtime.portalState.originNodeId ?? runtime.normalFlowNodeId;
    if (!portalId || !originId)
        return null;
    const savedListen = runtime.portalState.originListenExpectation ?? null;
    const probeListen = savedListen ??
        (await this.resolveOriginListenForReplay({
            runtime,
            userText,
            output,
            originId,
            preferSaved: false,
            clearSaved: false,
        }));
    if (!probeListen)
        return null;
    const confidenceThreshold = (0, brain_ranking_1.resolveConfidenceThreshold)(this.brainConfig?.confidenceThreshold);
    const brainCandidates = this.buildBrainCandidates(probeListen, runtime);
    const resolvedName = await (0, listen_expectation_1.tryResolveListenIntention)({
        listen: probeListen,
        userText,
        memory: runtime.memory,
    });
    let ranked;
    if (resolvedName) {
        ranked = (0, brain_ranking_1.scoresToRankedCandidates)([
            {
                name: resolvedName,
                confidence: 1,
                reason: code_intention_1.ROUTE_RESOLVED_VIA.UnknownOriginConsume,
            },
        ], brainCandidates);
        runtime.brainSequenceIndex = (runtime.brainSequenceIndex ?? 0) + 1;
    }
    else {
        const scan = await this.brain.scan({
            runtime,
            userText,
            listen: probeListen,
            candidates: brainCandidates,
            confidenceThreshold,
            history: {
                chat: runtime.history.chat,
                nodes: runtime.history.nodes,
            },
        });
        ranked = (0, brain_ranking_1.selectWalkableIntentions)(scan.intentions, confidenceThreshold, standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition);
    }
    ranked = ranked.filter((i) => i.name !== 'isContinue' &&
        i.name !== standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition);
    if (ranked.length === 0) {
        return null;
    }
    this.events.log('info', 'UNKNOWN_ORIGIN_CONSUME', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        portalId,
        originNodeId: originId,
        userText,
        resolvedName: resolvedName ?? null,
        ranked: ranked.map((i) => i.name),
        usedSavedOriginListen: Boolean(savedListen),
    });
    const portalOriginRestored = runtime.exitPortal();
    const targetId = portalOriginRestored ?? originId;
    runtime.enterNormalNode(targetId);
    runtime.listenExpectation = probeListen;
    const originCandidate = this.flowLoader.getFlow().nodes[targetId];
    const originNode = originCandidate
        ? this.nodes.get(originCandidate.class)
        : undefined;
    if (originNode) {
        this.stampListenTimeout(runtime, originNode);
    }
    const routed = await this.routeIntentions({
        runtime,
        userText,
        output,
        ranked,
        forceHop: forceHop + 1,
        resolvedVia: code_intention_1.ROUTE_RESOLVED_VIA.UnknownOriginConsume,
    });
    return {
        intentionNames: ranked.map((i) => i.name),
        selectedNodeId: routed.selectedNodeId,
        selectedClass: routed.selectedClass,
        result: routed.result,
        portalOriginRestored: portalOriginRestored ?? routed.portalOriginRestored,
    };
}
/**
 * Origin listen for Continue / unknown consume: prefer the snapshot taken at
 * portal enter (keeps `sayAndListen` overrides + resolveIntention).
 */
/**
 * Origin listen for Continue / unknown consume: prefer the snapshot taken at
 * portal enter (keeps `sayAndListen` overrides + resolveIntention).
 */
async function resolveOriginListenForReplay(input) {
    const { runtime, userText, output, originId, preferSaved, clearSaved } = input;
    const saved = preferSaved
        ? runtime.portalState.originListenExpectation
        : null;
    if (clearSaved) {
        runtime.portalState.originListenExpectation = null;
    }
    if (saved) {
        return saved;
    }
    const flow = this.flowLoader.getFlow();
    const originCandidate = flow.nodes[originId];
    if (!originCandidate)
        return null;
    const originNode = this.nodes.get(originCandidate.class);
    if (!originNode)
        return null;
    const listenCtx = (0, agent_node_1.nodeContextFromRuntime)({
        runtime,
        userText,
        output,
        events: this.events,
        brain: this.brain,
        integrations: this.integrations,
        forms: this.forms,
        intention: 'isContinue',
    });
    return originNode.listen(listenCtx);
}
/**
 * Exit the active portal (if any), restore the origin Node, refresh its
 * listen, re-scan the same user text, and route again — without speaking a
 * filler “Okay, continuing.”
 */
/**
 * Exit the active portal (if any), restore the origin Node, refresh its
 * listen, re-scan the same user text, and route again — without speaking a
 * filler “Okay, continuing.”
 */
async function replayOriginAfterContinue(input) {
    const { runtime, userText, output, forceHop, fromNodeId } = input;
    if (forceHop >= supervisor_types_1.MAX_FORCE_INTENTION_HOPS) {
        throw new Error(`continue replay hop limit (${supervisor_types_1.MAX_FORCE_INTENTION_HOPS}) exceeded`);
    }
    const originId = runtime.portalState.originNodeId ??
        runtime.normalFlowNodeId ??
        runtime.currentNodeId;
    // Keep snapshot before exitPortal clears it.
    const savedListen = runtime.portalState.originListenExpectation ?? null;
    let portalOriginRestored = null;
    if (runtime.portalState.activePortalId) {
        portalOriginRestored = runtime.exitPortal();
    }
    const targetId = portalOriginRestored ?? originId;
    if (!targetId || targetId === 'continue' || targetId === fromNodeId) {
        this.events.log('warn', 'CONTINUE_NO_ORIGIN', {
            conversationId: runtime.conversationId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            fromNodeId,
            originId,
            userText,
        });
        // Last resort: stay silent of filler — re-ask via unknown.
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
            forceHop,
        });
    }
    runtime.enterNormalNode(targetId);
    const flow = this.flowLoader.getFlow();
    const originCandidate = flow.nodes[targetId];
    if (!originCandidate) {
        throw new Error(`Continue origin node "${targetId}" missing from flow`);
    }
    const originNode = this.nodes.get(originCandidate.class);
    if (!originNode) {
        throw new Error(`Continue origin class not registered: ${originCandidate.class}`);
    }
    const listenExpectation = savedListen ??
        (await this.resolveOriginListenForReplay({
            runtime,
            userText,
            output,
            originId: targetId,
            preferSaved: false,
            clearSaved: false,
        }));
    if (!listenExpectation) {
        throw new Error(`Continue origin listen missing for "${targetId}"`);
    }
    runtime.listenExpectation = listenExpectation;
    this.stampListenTimeout(runtime, originNode);
    const confidenceThreshold = (0, brain_ranking_1.resolveConfidenceThreshold)(this.brainConfig?.confidenceThreshold);
    const brainCandidates = this.buildBrainCandidates(listenExpectation, runtime);
    const resolvedName = await (0, listen_expectation_1.tryResolveListenIntention)({
        listen: listenExpectation,
        userText,
        memory: runtime.memory,
    });
    const scan = resolvedName
        ? {
            intentions: (0, brain_ranking_1.scoresToRankedCandidates)([
                {
                    name: resolvedName,
                    confidence: 1,
                    reason: input.resolvedVia ?? code_intention_1.ROUTE_RESOLVED_VIA.Continue,
                },
            ], brainCandidates),
        }
        : await this.brain.scan({
            runtime,
            userText,
            listen: listenExpectation,
            candidates: brainCandidates,
            confidenceThreshold,
            history: {
                chat: runtime.history.chat,
                nodes: runtime.history.nodes,
            },
        });
    if (resolvedName) {
        runtime.brainSequenceIndex = (runtime.brainSequenceIndex ?? 0) + 1;
    }
    let ranked = (0, brain_ranking_1.selectWalkableIntentions)(scan.intentions, confidenceThreshold, standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition).filter((i) => i.name !== 'isContinue');
    if (ranked.length === 0) {
        ranked = [
            {
                name: standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition,
                confidence: 1,
                priority: 0,
                rank: 0,
            },
        ];
    }
    this.events.log('info', 'CONTINUE_REPLAY_ORIGIN', {
        conversationId: runtime.conversationId,
        runtimeInstanceId: runtime.runtimeInstanceId,
        fromNodeId,
        originNodeId: targetId,
        userText,
        resolvedName: resolvedName ?? null,
        ranked: ranked.map((i) => i.name),
        forceHop,
        via: input.resolvedVia ?? code_intention_1.ROUTE_RESOLVED_VIA.Continue,
        usedSavedOriginListen: Boolean(savedListen),
    });
    const routed = await this.routeIntentions({
        runtime,
        userText,
        output,
        ranked,
        forceHop,
        resolvedVia: input.resolvedVia ?? code_intention_1.ROUTE_RESOLVED_VIA.Continue,
    });
    return {
        ...routed,
        portalOriginRestored: portalOriginRestored ?? routed.portalOriginRestored,
    };
}
//# sourceMappingURL=supervisor-portal.js.map