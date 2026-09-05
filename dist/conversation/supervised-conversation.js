"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupervisedConversation = void 0;
const crypto_1 = require("crypto");
const conversation_history_1 = require("./conversation-history");
class SupervisedConversation {
    runtimeInstanceId;
    conversationId;
    providerCallId;
    flowId;
    createdAt;
    /** Currently executing node id (portal or normal). */
    currentNodeId;
    /** Last normal (non-portal) flow node — survives portal interruptions. */
    normalFlowNodeId;
    brainProfileId;
    brainSequenceIndex;
    portalState;
    memory;
    /** App-seeded basics for the whole Conversation (typed at the app boundary). */
    variables;
    /**
     * Active listen registration from the last Node (opened before its speech).
     * Next Brain scan uses this for intention boosts + hints.
     */
    listenExpectation;
    /**
     * False until flow.start Node has run() once.
     * Vapi Custom LLM "assistant speaks first" requires this opening turn
     * without a Brain intention scan.
     */
    openingCompleted;
    turn;
    status;
    metadata;
    /**
     * Compact transcript + node path for Brain scan and Node.before().
     * Session memory for the call — Chat Completions is stateless, so we
     * resend this rolling window instead of a vendor-side GPT thread.
     */
    history;
    /**
     * Full assistant utterances from the last completed turn (not compact history).
     * Replayed on a coalesced Custom LLM waiter so Vapi's *latest* HTTP request
     * still has speech — empty skip SSE is dead air.
     */
    lastAssistantSpeech;
    constructor(input) {
        this.runtimeInstanceId = input.runtimeInstanceId ?? (0, crypto_1.randomUUID)();
        this.conversationId = input.conversationId;
        this.providerCallId = input.providerCallId;
        this.flowId = input.flowId;
        this.createdAt = new Date();
        this.currentNodeId = input.startNodeId;
        this.normalFlowNodeId = input.startNodeId;
        this.brainProfileId = input.brainProfileId;
        this.brainSequenceIndex = 0;
        this.portalState = {
            activePortalId: null,
            originNodeId: null,
            originListenExpectation: null,
            transferToHuman: { reengagementAttempts: 0 },
            stillThere: { attempts: 0 },
        };
        this.memory = {};
        this.variables = input.variables ?? {};
        this.listenExpectation = null;
        this.openingCompleted = false;
        this.turn = { turnNumber: 0, interrupted: false };
        this.status = 'ACTIVE';
        this.metadata = input.metadata ?? {};
        this.history = (0, conversation_history_1.emptyConversationHistory)();
        this.lastAssistantSpeech = [];
    }
    enterPortal(portalNodeId) {
        if (!this.portalState.activePortalId) {
            this.portalState.originNodeId =
                this.normalFlowNodeId ?? this.currentNodeId;
            // Capture before the portal Node overwrites runtime.listenExpectation.
            this.portalState.originListenExpectation = this.listenExpectation;
        }
        this.portalState.activePortalId = portalNodeId;
        this.currentNodeId = portalNodeId;
    }
    exitPortal() {
        const origin = this.portalState.originNodeId ?? this.normalFlowNodeId;
        this.portalState.activePortalId = null;
        this.portalState.originNodeId = null;
        this.portalState.originListenExpectation = null;
        if (origin) {
            this.currentNodeId = origin;
            this.normalFlowNodeId = origin;
        }
        return origin;
    }
    enterNormalNode(nodeId) {
        if (this.portalState.activePortalId) {
            this.exitPortal();
        }
        this.currentNodeId = nodeId;
        this.normalFlowNodeId = nodeId;
    }
    snapshot() {
        return {
            runtimeInstanceId: this.runtimeInstanceId,
            conversationId: this.conversationId,
            providerCallId: this.providerCallId,
            flowId: this.flowId,
            currentNodeId: this.currentNodeId,
            normalFlowNodeId: this.normalFlowNodeId,
            brainProfileId: this.brainProfileId,
            brainSequenceIndex: this.brainSequenceIndex,
            portalState: this.portalState,
            memory: this.memory,
            variables: this.variables,
            listenExpectation: this.listenExpectation,
            openingCompleted: this.openingCompleted,
            turn: this.turn,
            status: this.status,
            metadata: this.metadata,
            history: this.history,
            lastAssistantSpeech: this.lastAssistantSpeech,
            createdAt: this.createdAt.toISOString(),
        };
    }
    /** Rebuild an in-memory runtime from a DB checkpoint (crash recovery). */
    static fromSnapshot(raw) {
        const conversationId = String(raw.conversationId ?? '');
        const providerCallId = String(raw.providerCallId ?? '');
        const flowId = String(raw.flowId ?? '');
        const brainProfileId = String(raw.brainProfileId ?? 'default');
        const startNodeId = String(raw.currentNodeId ?? raw.normalFlowNodeId ?? 'unknown');
        const runtime = new SupervisedConversation({
            conversationId,
            providerCallId,
            flowId,
            brainProfileId,
            startNodeId,
            runtimeInstanceId: typeof raw.runtimeInstanceId === 'string'
                ? raw.runtimeInstanceId
                : undefined,
            metadata: raw.metadata && typeof raw.metadata === 'object'
                ? raw.metadata
                : {},
            variables: raw.variables && typeof raw.variables === 'object'
                ? raw.variables
                : {},
        });
        runtime.currentNodeId =
            typeof raw.currentNodeId === 'string' ? raw.currentNodeId : null;
        runtime.normalFlowNodeId =
            typeof raw.normalFlowNodeId === 'string' ? raw.normalFlowNodeId : null;
        runtime.brainSequenceIndex =
            typeof raw.brainSequenceIndex === 'number' ? raw.brainSequenceIndex : 0;
        if (raw.portalState && typeof raw.portalState === 'object') {
            const ps = raw.portalState;
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
        if (raw.memory && typeof raw.memory === 'object') {
            runtime.memory = raw.memory;
        }
        runtime.listenExpectation =
            raw.listenExpectation ?? null;
        runtime.openingCompleted = Boolean(raw.openingCompleted);
        if (raw.turn && typeof raw.turn === 'object') {
            runtime.turn = raw.turn;
        }
        runtime.status =
            raw.status === 'ENDED' || raw.status === 'FINALIZING'
                ? raw.status
                : 'ACTIVE';
        if (raw.history && typeof raw.history === 'object') {
            runtime.history = raw.history;
        }
        if (Array.isArray(raw.lastAssistantSpeech)) {
            runtime.lastAssistantSpeech = raw.lastAssistantSpeech.map(String);
        }
        if (typeof raw.createdAt === 'string') {
            const parsed = new Date(raw.createdAt);
            if (!Number.isNaN(parsed.getTime())) {
                runtime.createdAt = parsed;
            }
        }
        return runtime;
    }
}
exports.SupervisedConversation = SupervisedConversation;
//# sourceMappingURL=supervised-conversation.js.map