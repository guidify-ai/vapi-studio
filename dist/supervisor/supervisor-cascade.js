"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentionList = intentionList;
exports.tryForceIntentions = tryForceIntentions;
exports.tryMatchIntentions = tryMatchIntentions;
exports.buildBrainCandidates = buildBrainCandidates;
const conversation_history_1 = require("../conversation/conversation-history");
const standard_intentions_1 = require("../intentions/standard-intentions");
const code_intention_1 = require("../intention/code-intention");
const conversation_output_1 = require("../output/conversation-output");
const flow_loader_1 = require("../flow/flow-loader");
const conversation_console_1 = require("../events/conversation-console");
function intentionList() {
    return this.intentions ? [...this.intentions.values()] : [];
}
/**
 * phase: 'force' — before listen/Brain. First before()===true wins (registry order).
 */
/**
 * phase: 'force' — before listen/Brain. First before()===true wins (registry order).
 */
async function tryForceIntentions(input) {
    const forceList = this.intentionList().filter((i) => i.phase === code_intention_1.INTENTION_CASCADE_PHASE.Force);
    if (!forceList.length)
        return null;
    const ctx = (0, code_intention_1.intentionContextFromRuntime)({
        runtime: input.runtime,
        userText: input.userText,
        events: this.events,
    });
    const output = new conversation_output_1.BufferedConversationOutput(input.onSay);
    for (const intention of forceList) {
        const ok = await intention.before(ctx);
        if (!ok)
            continue;
        const confidence = (await intention.match(ctx)) ?? 1;
        const runResult = await intention.run(ctx);
        await intention.after(ctx);
        const gotoNodeId = runResult?.kind === code_intention_1.INTENTION_RUN_KIND.Goto
            ? runResult.nodeId
            : intention.toNodeId ?? null;
        const reason = (runResult && 'reason' in runResult ? runResult.reason : undefined) ??
            intention.reason ??
            null;
        const payload = {
            conversationId: input.runtime.conversationId,
            runtimeInstanceId: input.runtime.runtimeInstanceId,
            providerCallId: input.runtime.providerCallId,
            turnNumber: input.runtime.turn.turnNumber,
            intention: intention.name,
            phase: code_intention_1.INTENTION_CASCADE_PHASE.Force,
            from: input.runtime.currentNodeId,
            to: gotoNodeId,
            confidence,
            priority: intention.priority,
            boost: intention.boost,
            reason,
            userText: input.userText,
            memory: (0, conversation_console_1.snapshotUserMemory)(input.runtime.memory),
        };
        if (input.runtime.conversationId) {
            await this.events.persist(input.runtime.conversationId, 'INTENTION_FORCE', payload);
        }
        else {
            this.events.log('info', 'INTENTION_FORCE', payload);
        }
        const rankedName = gotoNodeId
            ? (0, flow_loader_1.conditionGotoIntention)(gotoNodeId)
            : intention.name;
        const ranked = [
            {
                name: rankedName,
                confidence: Math.min(1, Math.max(0, confidence)),
                priority: intention.priority || 1_000_000,
                rank: 0,
            },
        ];
        const routed = await this.routeIntentions({
            runtime: input.runtime,
            userText: input.userText,
            output,
            ranked,
            forceHop: 0,
            resolvedVia: code_intention_1.ROUTE_RESOLVED_VIA.IntentionForce,
            allowMiss: true,
        });
        if (!routed) {
            this.events.log('warn', 'INTENTION_FORCE_MISSED', {
                ...payload,
                note: 'force intention matched but no node accepted before()',
            });
            continue;
        }
        this.stampPendingToolNode(input.runtime, routed.result, routed.selectedNodeId);
        return {
            runtime: input.runtime,
            intentionNames: [intention.name],
            selectedNodeId: routed.selectedNodeId,
            selectedClass: routed.selectedClass,
            result: routed.result,
            actions: output.actions,
            portalOriginRestored: routed.portalOriginRestored,
        };
    }
    return null;
}
/**
 * phase: 'match' — local confidence; may skip Brain. goto from run() routes now.
 */
/**
 * phase: 'match' — local confidence; may skip Brain. goto from run() routes now.
 */
async function tryMatchIntentions(input) {
    const matchList = this.intentionList().filter((i) => i.phase === code_intention_1.INTENTION_CASCADE_PHASE.Match);
    if (!matchList.length)
        return null;
    const ctx = (0, code_intention_1.intentionContextFromRuntime)({
        runtime: input.runtime,
        userText: input.userText,
        events: this.events,
    });
    for (const intention of matchList) {
        const ok = await intention.before(ctx);
        if (!ok)
            continue;
        const matched = await intention.match(ctx);
        if (matched == null)
            continue;
        const confidence = Math.min(1, Math.max(0, matched));
        if (confidence < input.confidenceThreshold)
            continue;
        const runResult = await intention.run(ctx);
        await intention.after(ctx);
        this.events.log('info', 'INTENTION_MATCH', {
            conversationId: input.runtime.conversationId,
            runtimeInstanceId: input.runtime.runtimeInstanceId,
            turnNumber: input.runtime.turn.turnNumber,
            intention: intention.name,
            confidence,
            run: runResult,
            userText: input.userText,
        });
        const gotoNodeId = runResult?.kind === code_intention_1.INTENTION_RUN_KIND.Goto
            ? runResult.nodeId
            : intention.toNodeId ?? null;
        if (gotoNodeId) {
            const output = new conversation_output_1.BufferedConversationOutput(input.onSay);
            const routed = await this.routeIntentions({
                runtime: input.runtime,
                userText: input.userText,
                output,
                ranked: [
                    {
                        name: (0, flow_loader_1.conditionGotoIntention)(gotoNodeId),
                        confidence,
                        priority: intention.priority || 1_000_000,
                        rank: 0,
                    },
                ],
                forceHop: 0,
                resolvedVia: code_intention_1.ROUTE_RESOLVED_VIA.IntentionMatch,
                allowMiss: true,
            });
            if (routed) {
                this.stampPendingToolNode(input.runtime, routed.result, routed.selectedNodeId);
                return {
                    kind: 'routed',
                    result: {
                        runtime: input.runtime,
                        intentionNames: [intention.name],
                        selectedNodeId: routed.selectedNodeId,
                        selectedClass: routed.selectedClass,
                        result: routed.result,
                        actions: output.actions,
                        portalOriginRestored: routed.portalOriginRestored,
                    },
                };
            }
        }
        return { kind: 'score', name: intention.name, confidence };
    }
    return null;
}
/**
 * Limited Brain candidate set for this listen:
 * - listen-prioritized next-node intentions (with boost + priority)
 * - registered CodeIntention boost/priority overlays
 * - all portal intentions (except: while in `mad`, only the mad portal — sticky)
 * - studio.isUnknownTransition (scan-failure global; not while sticky mad)
 * - if no listen yet: all normal-flow intentions + portals
 */
/**
 * Limited Brain candidate set for this listen:
 * - listen-prioritized next-node intentions (with boost + priority)
 * - registered CodeIntention boost/priority overlays
 * - all portal intentions (except: while in `mad`, only the mad portal — sticky)
 * - studio.isUnknownTransition (scan-failure global; not while sticky mad)
 * - if no listen yet: all normal-flow intentions + portals
 */
function buildBrainCandidates(listen, runtime) {
    const byName = new Map();
    const upsert = (option) => {
        const existing = byName.get(option.name);
        if (!existing) {
            byName.set(option.name, {
                ...option,
                priority: option.priority ?? conversation_history_1.DEFAULT_INTENTION_PRIORITY,
            });
            return;
        }
        byName.set(option.name, {
            ...existing,
            boost: Math.max(existing.boost ?? 0, option.boost ?? 0),
            priority: Math.max(existing.priority ?? conversation_history_1.DEFAULT_INTENTION_PRIORITY, option.priority ?? conversation_history_1.DEFAULT_INTENTION_PRIORITY),
            source: existing.source === 'listen' ? 'listen' : option.source,
        });
    };
    for (const intent of listen?.intentions ?? []) {
        upsert({
            name: intent.name,
            boost: intent.boost,
            priority: intent.priority,
            source: 'listen',
        });
    }
    for (const intention of this.intentionList()) {
        if (intention.phase === code_intention_1.INTENTION_CASCADE_PHASE.Force)
            continue;
        upsert({
            name: intention.name,
            boost: intention.boost,
            priority: intention.priority,
            source: 'runtime',
        });
    }
    const stickyMad = runtime?.portalState.activePortalId === 'mad';
    const madIntentionNames = stickyMad
        ? new Set(this.flowLoader.getFlow().nodes.mad?.intentions ?? [])
        : null;
    for (const name of this.flowLoader.portalIntentionNames()) {
        if (madIntentionNames && !madIntentionNames.has(name)) {
            continue;
        }
        upsert({ name, source: 'portal' });
    }
    if (!listen?.intentions?.length) {
        for (const name of this.flowLoader.normalIntentionNames()) {
            upsert({ name, source: 'flow' });
        }
    }
    if (!stickyMad) {
        upsert({
            name: standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition,
            boost: 0,
            priority: 0,
            source: 'runtime',
        });
    }
    return [...byName.values()];
}
//# sourceMappingURL=supervisor-cascade.js.map