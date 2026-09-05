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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationBootstrapService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const supervised_conversation_1 = require("./supervised-conversation");
const supervised_conversation_registry_1 = require("./supervised-conversation.registry");
const call_turn_queue_1 = require("./call-turn-queue");
const conversation_repository_1 = require("../persistence/conversation.repository");
const conversation_repository_2 = require("../persistence/conversation.repository");
const event_service_1 = require("../events/event.service");
const daily_log_driver_1 = require("../events/daily-log.driver");
const brain_usage_tracker_1 = require("../brain/brain-usage.tracker");
const flow_loader_1 = require("../flow/flow-loader");
const conversation_entry_1 = require("./conversation-entry");
function isUniqueViolation(error) {
    if (!error || typeof error !== 'object')
        return false;
    const e = error;
    return e.code === '23505' || e.driverError?.code === '23505';
}
let ConversationBootstrapService = class ConversationBootstrapService {
    conversations;
    registry;
    flowLoader;
    events;
    turnQueues;
    brainUsage;
    entry;
    /** Serialize concurrent bootstrap for the same Vapi call (assistant.started ∥ Custom LLM). */
    bootstrapping = new Map();
    constructor(conversations, registry, flowLoader, events, turnQueues, brainUsage, entryPoint) {
        this.conversations = conversations;
        this.registry = registry;
        this.flowLoader = flowLoader;
        this.events = events;
        this.turnQueues = turnQueues;
        this.brainUsage = brainUsage;
        this.entry = entryPoint ?? new conversation_entry_1.DefaultConversationEntry();
    }
    async bootstrap(input) {
        const existing = this.registry.getByProviderCallId(input.providerCallId);
        if (existing) {
            this.openCallLog(existing, input.metadata);
            this.events.log('warn', 'BOOTSTRAP_REUSE', {
                providerCallId: input.providerCallId,
                runtimeInstanceId: existing.runtimeInstanceId,
                conversationId: existing.conversationId,
            });
            return existing;
        }
        const inflight = this.bootstrapping.get(input.providerCallId);
        if (inflight) {
            this.events.log('info', 'BOOTSTRAP_WAIT', {
                providerCallId: input.providerCallId,
            });
            return inflight;
        }
        const pending = this.bootstrapExclusive(input).finally(() => {
            this.bootstrapping.delete(input.providerCallId);
        });
        this.bootstrapping.set(input.providerCallId, pending);
        return pending;
    }
    async bootstrapExclusive(input) {
        const raced = this.registry.getByProviderCallId(input.providerCallId);
        if (raced) {
            this.openCallLog(raced, input.metadata);
            return raced;
        }
        const flow = this.flowLoader.getFlow();
        const runtimeInstanceId = (0, crypto_1.randomUUID)();
        const seeded = await this.entry.createVariables({
            providerCallId: input.providerCallId,
            metadata: input.metadata,
        });
        const variables = {
            ...seeded,
            ...(input.variables ?? {}),
        };
        let row;
        try {
            row = await this.conversations.createActive({
                projectId: input.projectId,
                providerCallId: input.providerCallId,
                runtimeInstanceId,
                metadata: {
                    ...(input.metadata ?? {}),
                    projectId: input.projectId,
                    variables,
                },
                callerId: (0, conversation_repository_2.extractCallerIdFromBags)(input.metadata, variables),
                provider: input.metadata?.channel === 'web'
                    ? 'studio'
                    : input.metadata?.channel === 'phone'
                        ? 'vapi'
                        : undefined,
            });
        }
        catch (error) {
            if (!isUniqueViolation(error)) {
                throw error;
            }
            // Parallel webhook + Custom LLM both inserted — attach to the winner.
            const existingRow = await this.conversations.findByProviderCallId(input.providerCallId, input.projectId);
            if (!existingRow) {
                throw error;
            }
            const attached = this.registry.getByProviderCallId(input.providerCallId);
            if (attached) {
                this.openCallLog(attached, input.metadata);
                this.events.log('warn', 'BOOTSTRAP_REUSE_AFTER_RACE', {
                    providerCallId: input.providerCallId,
                    conversationId: attached.conversationId,
                    runtimeInstanceId: attached.runtimeInstanceId,
                });
                return attached;
            }
            const runtime = new supervised_conversation_1.SupervisedConversation({
                conversationId: existingRow.id,
                providerCallId: input.providerCallId,
                flowId: flow.id,
                brainProfileId: input.brainProfileId,
                startNodeId: flow.start,
                runtimeInstanceId: existingRow.runtimeInstanceId ?? runtimeInstanceId,
                metadata: input.metadata,
                variables: {
                    ...(existingRow.metadata?.variables ??
                        {}),
                    ...variables,
                },
            });
            this.registry.set(runtime);
            this.openCallLog(runtime, input.metadata);
            this.events.log('warn', 'BOOTSTRAP_ATTACH_EXISTING_ROW', {
                providerCallId: input.providerCallId,
                conversationId: runtime.conversationId,
                runtimeInstanceId: runtime.runtimeInstanceId,
            });
            return runtime;
        }
        const runtime = new supervised_conversation_1.SupervisedConversation({
            conversationId: row.id,
            providerCallId: input.providerCallId,
            flowId: flow.id,
            brainProfileId: input.brainProfileId,
            startNodeId: flow.start,
            runtimeInstanceId,
            metadata: input.metadata,
            variables,
        });
        this.registry.set(runtime);
        this.openCallLog(runtime, input.metadata);
        await this.events.persist(runtime.conversationId, 'BOOTSTRAP', {
            providerCallId: runtime.providerCallId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            flowId: runtime.flowId,
            brainProfileId: runtime.brainProfileId,
            variables: runtime.variables,
        });
        if (this.entry.beforeEach) {
            await this.entry.beforeEach({
                runtime,
                variables: runtime.variables,
            });
            await this.events.persist(runtime.conversationId, 'CONVERSATION_BEFORE_EACH', {
                providerCallId: runtime.providerCallId,
                runtimeInstanceId: runtime.runtimeInstanceId,
                variables: runtime.variables,
            });
        }
        await this.checkpoint(runtime);
        return runtime;
    }
    openCallLog(runtime, metadata) {
        const fromMeta = metadata?.callerPhoneNumber;
        const phone = (typeof fromMeta === 'string' && fromMeta.trim()
            ? fromMeta.trim()
            : null) ??
            (typeof runtime.metadata.callerPhoneNumber === 'string'
                ? runtime.metadata.callerPhoneNumber
                : null);
        if (phone) {
            runtime.metadata.callerPhoneNumber = phone;
        }
        (0, daily_log_driver_1.beginCallLog)({
            callId: runtime.providerCallId,
            callerPhone: phone,
        });
    }
    async finalizeEnded(providerCallId) {
        const runtime = this.registry.getByProviderCallId(providerCallId);
        if (!runtime) {
            this.events.log('warn', 'FINALIZE_MISSING_RUNTIME', { providerCallId });
            return;
        }
        runtime.status = 'FINALIZING';
        if (this.entry.afterEach) {
            await this.entry.afterEach({
                runtime,
                variables: runtime.variables,
            });
            await this.events.persist(runtime.conversationId, 'CONVERSATION_AFTER_EACH', {
                providerCallId,
                runtimeInstanceId: runtime.runtimeInstanceId,
                variables: runtime.variables,
            });
        }
        const finalState = runtime.snapshot();
        await this.conversations.markEnded({
            conversationId: runtime.conversationId,
            finalState,
            callerId: (0, conversation_repository_2.extractCallerIdFromBags)(runtime.variables, runtime.metadata),
        });
        await this.events.persist(runtime.conversationId, 'FINALIZE', {
            providerCallId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            finalState,
        });
        runtime.status = 'ENDED';
        this.registry.delete(providerCallId);
        this.turnQueues.delete(providerCallId);
        const cost = this.brainUsage.summary(providerCallId);
        if (cost && cost.calls > 0) {
            this.events.log('info', 'BRAIN_COST_SUMMARY', {
                providerCallId,
                conversationId: runtime.conversationId,
                runtimeInstanceId: runtime.runtimeInstanceId,
                calls: cost.calls,
                promptTokens: cost.promptTokens,
                completionTokens: cost.completionTokens,
                totalTokens: cost.totalTokens,
                estimatedUsd: cost.estimatedUsd,
                money: this.brainUsage.formatMoney(cost.estimatedUsd),
                byModel: cost.byModel,
            });
        }
        this.brainUsage.clear(providerCallId);
        this.events.log('info', 'RUNTIME_REMOVED', {
            providerCallId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            conversationId: runtime.conversationId,
            registrySize: this.registry.size(),
        });
    }
    /** Persist live runtime so a process crash can restore ACTIVE conversations. */
    async checkpoint(runtime) {
        if (runtime.status !== 'ACTIVE')
            return;
        const runtimeState = runtime.snapshot();
        await this.conversations.saveRuntimeCheckpoint({
            conversationId: runtime.conversationId,
            runtimeState,
            callerId: (0, conversation_repository_2.extractCallerIdFromBags)(runtime.variables, runtime.metadata),
        });
        this.events.log('info', 'RUNTIME_CHECKPOINT', {
            conversationId: runtime.conversationId,
            providerCallId: runtime.providerCallId,
            runtimeInstanceId: runtime.runtimeInstanceId,
            turnNumber: runtime.turn.turnNumber,
            currentNodeId: runtime.currentNodeId,
        });
    }
    /**
     * Simulate process memory loss: drop all in-memory runtimes without ending DB rows.
     * Checkpoints already in Postgres remain ACTIVE for restore.
     */
    simulateCrash() {
        const providerCallIds = [];
        // Registry has no list API — snapshot via size + known map through delete loop.
        // Collect by scanning provider ids from active DB would race; use registry internals via size.
        const before = this.registry.size();
        for (const runtime of this.listRegistryRuntimes()) {
            providerCallIds.push(runtime.providerCallId);
            this.registry.delete(runtime.providerCallId);
            this.turnQueues.delete(runtime.providerCallId);
        }
        this.events.log('warn', 'DISASTER_SIMULATE_CRASH', {
            dropped: providerCallIds.length,
            providerCallIds,
            registrySizeBefore: before,
            registrySizeAfter: this.registry.size(),
        });
        return { dropped: providerCallIds.length, providerCallIds };
    }
    /** Reload every ACTIVE conversation that has a runtime_state checkpoint. */
    async restoreAllActive() {
        const rows = await this.conversations.listActiveWithState();
        let restored = 0;
        let skipped = 0;
        const conversationIds = [];
        for (const row of rows) {
            if (this.registry.getByConversationId(row.id)) {
                skipped += 1;
                continue;
            }
            if (!row.runtimeState) {
                skipped += 1;
                continue;
            }
            const runtime = supervised_conversation_1.SupervisedConversation.fromSnapshot(row.runtimeState);
            // Ensure DB identity wins if snapshot drifted.
            if (runtime.conversationId !== row.id) {
                skipped += 1;
                this.events.log('warn', 'DISASTER_RESTORE_SKIP_ID_MISMATCH', {
                    rowId: row.id,
                    snapshotConversationId: runtime.conversationId,
                });
                continue;
            }
            runtime.status = 'ACTIVE';
            this.registry.set(runtime);
            this.openCallLog(runtime, runtime.metadata);
            conversationIds.push(runtime.conversationId);
            restored += 1;
            await this.events.persist(runtime.conversationId, 'DISASTER_RESTORED', {
                providerCallId: runtime.providerCallId,
                runtimeInstanceId: runtime.runtimeInstanceId,
                currentNodeId: runtime.currentNodeId,
                turnNumber: runtime.turn.turnNumber,
            });
        }
        this.events.log('info', 'DISASTER_RESTORE_ALL', {
            restored,
            skipped,
            conversationIds,
            registrySize: this.registry.size(),
        });
        return { restored, skipped, conversationIds };
    }
    async disasterStatus() {
        const memory = this.listRegistryRuntimes().map((r) => ({
            conversationId: r.conversationId,
            providerCallId: r.providerCallId,
            currentNodeId: r.currentNodeId,
            turnNumber: r.turn.turnNumber,
        }));
        const active = await this.conversations.listActive();
        const withState = await this.conversations.listActiveWithState();
        return {
            memoryCount: memory.length,
            dbActiveCount: active.length,
            dbCheckpointCount: withState.length,
            memory,
        };
    }
    /** Registry has no public iterator — poke via provider ids we track on restore/bootstrap. */
    listRegistryRuntimes() {
        return this.registry.list();
    }
};
exports.ConversationBootstrapService = ConversationBootstrapService;
exports.ConversationBootstrapService = ConversationBootstrapService = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Optional)()),
    __param(6, (0, common_1.Inject)(conversation_entry_1.CONVERSATION_ENTRY_POINT)),
    __metadata("design:paramtypes", [conversation_repository_1.ConversationRepository,
        supervised_conversation_registry_1.SupervisedConversationRegistry,
        flow_loader_1.FlowLoader,
        event_service_1.EventService,
        call_turn_queue_1.CallTurnQueueRegistry,
        brain_usage_tracker_1.BrainUsageTracker, Object])
], ConversationBootstrapService);
//# sourceMappingURL=conversation-bootstrap.service.js.map