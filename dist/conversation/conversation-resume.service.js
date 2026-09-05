"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationResumeService = exports.DEFAULT_RESUME_WITHIN_MS = void 0;
const common_1 = require("@nestjs/common");
const conversation_history_1 = require("./conversation-history");
const event_service_1 = require("../events/event.service");
const conversation_repository_1 = require("../persistence/conversation.repository");
const supervised_conversation_registry_1 = require("./supervised-conversation.registry");
const call_turn_queue_1 = require("./call-turn-queue");
const brain_usage_tracker_1 = require("../brain/brain-usage.tracker");
/** Default window for “continue where you left off?” */
exports.DEFAULT_RESUME_WITHIN_MS = 10 * 60 * 1000;
const CHANNEL_META_KEYS = [
    'caller',
    'callerId',
    'channel',
    'callerPhoneNumber',
    'callerChannel',
    'startedBy',
    'afterHours',
    'abOverrides',
    'featureFlags',
];
/**
 * Cross-call resume: find a recent Conversation for the same caller and
 * clone its durable state into the **current** call (new providerCallId).
 *
 * Avoids injecting ConversationBootstrapService (Entry↔Bootstrap cycle).
 */
let ConversationResumeService = class ConversationResumeService {
    conversations;
    events;
    registry;
    turnQueues;
    brainUsage;
    constructor(conversations, events, registry, turnQueues, brainUsage) {
        this.conversations = conversations;
        this.events = events;
        this.registry = registry;
        this.turnQueues = turnQueues;
        this.brainUsage = brainUsage;
    }
    async peek(input) {
        const prior = await this.conversations.findResumableForCaller({
            callerId: input.callerId,
            withinMs: input.withinMs ?? exports.DEFAULT_RESUME_WITHIN_MS,
            excludeConversationId: input.excludeConversationId,
        });
        if (!prior)
            return null;
        const mem = prior.state.memory && typeof prior.state.memory === 'object'
            ? prior.state.memory
            : {};
        const meta = prior.state.metadata && typeof prior.state.metadata === 'object'
            ? prior.state.metadata
            : {};
        return {
            prior,
            summary: {
                activeModuleId: typeof meta.activeModuleId === 'string' ? meta.activeModuleId : null,
                currentNodeId: typeof prior.state.currentNodeId === 'string'
                    ? prior.state.currentNodeId
                    : null,
                firstName: typeof mem.firstName === 'string' ? mem.firstName : null,
            },
        };
    }
    async applyCloneByConversationId(runtime, priorConversationId) {
        const row = await this.conversations.findById(priorConversationId);
        if (!row)
            return false;
        const state = row.status === 'ENDED'
            ? row.finalState
            : (row.runtimeState ?? row.finalState);
        if (!state || typeof state !== 'object')
            return false;
        await this.applyClone(runtime, {
            conversationId: row.id,
            providerCallId: row.providerCallId,
            status: row.status,
            state: state,
            activityAt: row.lastActivityAt ?? row.endedAt ?? row.createdAt,
        });
        return true;
    }
    async applyClone(runtime, prior) {
        const state = prior.state;
        const keepVars = { ...runtime.variables };
        const keepMeta = {};
        for (const key of CHANNEL_META_KEYS) {
            if (runtime.metadata[key] !== undefined) {
                keepMeta[key] = runtime.metadata[key];
            }
        }
        const priorMeta = state.metadata && typeof state.metadata === 'object'
            ? { ...state.metadata }
            : {};
        const priorMemory = state.memory && typeof state.memory === 'object'
            ? { ...state.memory }
            : {};
        delete priorMemory.pendingResumeConversationId;
        delete priorMemory.pendingResumeAsked;
        delete priorMemory.pendingResumeModuleId;
        delete priorMemory.pendingResumeNodeId;
        priorMemory.resumedFromConversationId = prior.conversationId;
        runtime.memory = priorMemory;
        if (state.history && typeof state.history === 'object') {
            runtime.history = state.history;
        }
        else {
            runtime.history = (0, conversation_history_1.emptyConversationHistory)();
        }
        if (state.portalState && typeof state.portalState === 'object') {
            const ps = state.portalState;
            runtime.portalState = {
                activePortalId: ps.activePortalId ?? null,
                originNodeId: ps.originNodeId ?? null,
                originListenExpectation: null,
                transferToHuman: {
                    reengagementAttempts: ps.transferToHuman?.reengagementAttempts ?? 0,
                },
                stillThere: {
                    attempts: ps.stillThere?.attempts ?? 0,
                },
            };
        }
        runtime.currentNodeId =
            typeof state.currentNodeId === 'string' ? state.currentNodeId : null;
        runtime.normalFlowNodeId =
            typeof state.normalFlowNodeId === 'string'
                ? state.normalFlowNodeId
                : runtime.currentNodeId;
        runtime.brainSequenceIndex =
            typeof state.brainSequenceIndex === 'number'
                ? state.brainSequenceIndex
                : 0;
        runtime.openingCompleted = true;
        runtime.listenExpectation =
            state.listenExpectation ?? null;
        runtime.lastAssistantSpeech = Array.isArray(state.lastAssistantSpeech)
            ? state.lastAssistantSpeech.filter((s) => typeof s === 'string')
            : [];
        if (state.turn && typeof state.turn === 'object') {
            const t = state.turn;
            runtime.turn = {
                turnNumber: typeof t.turnNumber === 'number'
                    ? t.turnNumber
                    : runtime.turn.turnNumber,
                interrupted: Boolean(t.interrupted),
                lastInterruptAt: t.lastInterruptAt,
            };
        }
        if (typeof state.brainProfileId === 'string' && state.brainProfileId) {
            runtime.brainProfileId = state.brainProfileId;
        }
        const priorVars = state.variables && typeof state.variables === 'object'
            ? { ...state.variables }
            : {};
        runtime.variables = {
            ...priorVars,
            ...keepVars,
        };
        runtime.metadata = {
            ...priorMeta,
            ...keepMeta,
            activeModuleId: priorMeta.activeModuleId ?? null,
            workflowId: priorMeta.workflowId ?? null,
            lastHandoff: priorMeta.lastHandoff,
            resumedFromConversationId: prior.conversationId,
            resumedFromProviderCallId: prior.providerCallId,
        };
        const cloned = await this.conversations.cloneEvents({
            fromConversationId: prior.conversationId,
            toConversationId: runtime.conversationId,
        });
        await this.events.persist(runtime.conversationId, 'CONVERSATION_RESUMED', {
            fromConversationId: prior.conversationId,
            fromProviderCallId: prior.providerCallId,
            fromStatus: prior.status,
            eventsCloned: cloned,
            currentNodeId: runtime.currentNodeId,
            activeModuleId: runtime.metadata.activeModuleId ?? null,
            callerId: (0, conversation_repository_1.extractCallerIdFromBags)(runtime.variables, runtime.metadata),
        });
        if (runtime.status === 'ACTIVE') {
            await this.conversations.saveRuntimeCheckpoint({
                conversationId: runtime.conversationId,
                runtimeState: runtime.snapshot(),
                callerId: (0, conversation_repository_1.extractCallerIdFromBags)(runtime.variables, runtime.metadata),
            });
        }
        if (prior.status === 'ACTIVE') {
            await this.sealAbandonedPrior(prior);
        }
    }
    async sealAbandonedPrior(prior) {
        const live = this.registry.getByProviderCallId(prior.providerCallId);
        if (live && live.conversationId === prior.conversationId) {
            live.status = 'ENDED';
            this.registry.delete(prior.providerCallId);
            this.turnQueues.delete(prior.providerCallId);
            this.brainUsage.clear(prior.providerCallId);
        }
        await this.conversations.markEnded({
            conversationId: prior.conversationId,
            finalState: {
                ...prior.state,
                status: 'ENDED',
                supersededByResume: true,
            },
            callerId: (0, conversation_repository_1.extractCallerIdFromBags)(prior.state.variables, prior.state.metadata),
        });
    }
};
exports.ConversationResumeService = ConversationResumeService;
exports.ConversationResumeService = ConversationResumeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [conversation_repository_1.ConversationRepository,
        event_service_1.EventService,
        supervised_conversation_registry_1.SupervisedConversationRegistry,
        call_turn_queue_1.CallTurnQueueRegistry,
        brain_usage_tracker_1.BrainUsageTracker])
], ConversationResumeService);
//# sourceMappingURL=conversation-resume.service.js.map