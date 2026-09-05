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
exports.WorkflowHandoffService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const flow_loader_1 = require("../flow/flow-loader");
const event_service_1 = require("../events/event.service");
const workflow_loader_1 = require("./workflow-loader");
const conversation_bootstrap_service_1 = require("../conversation/conversation-bootstrap.service");
/**
 * Applies workflow module handoffs and same-flow `continueTo` jumps on a
 * shared Conversation runtime. Does not end the Conversation.
 */
let WorkflowHandoffService = class WorkflowHandoffService {
    workflows;
    flows;
    events;
    bootstrap;
    constructor(workflows, flows, events, bootstrap) {
        this.workflows = workflows;
        this.flows = flows;
        this.events = events;
        this.bootstrap = bootstrap;
    }
    configDir() {
        return process.env.CONFIG_DIR ?? (0, path_1.join)(process.cwd(), 'config');
    }
    /**
     * Enrich handoff actions with Vapi assistantName; apply in-memory module
     * switches and same-flow continueTo jumps. Returns the (possibly enriched) actions.
     */
    async applyHandoffs(runtime, actions) {
        const out = [];
        for (const action of actions) {
            if (action.kind === 'continueTo' && action.continueToNodeId) {
                out.push(action);
                await this.applyContinueTo(runtime, action);
                continue;
            }
            if (action.kind !== 'handoff' || !action.handoffTo) {
                out.push(action);
                continue;
            }
            if (!this.workflows.hasWorkflow()) {
                // Handoff requested but no Squad workflow loaded — treat as no-op warn.
                this.events.log('warn', 'HANDOFF_WITHOUT_WORKFLOW', {
                    conversationId: runtime.conversationId,
                    handoffTo: action.handoffTo,
                    note: 'output.handoff requires a loaded workflow.yaml; use continueTo for single-assistant jumps.',
                });
                out.push(action);
                continue;
            }
            const mod = this.workflows.getModule(action.handoffTo);
            const enriched = {
                ...action,
                assistantName: mod.assistantName,
            };
            out.push(enriched);
            const fromModule = typeof runtime.metadata.activeModuleId === 'string'
                ? runtime.metadata.activeModuleId
                : null;
            runtime.metadata.activeModuleId = mod.id;
            runtime.metadata.workflowId = this.workflows.getWorkflow().id;
            runtime.metadata.lastHandoff = {
                from: fromModule,
                to: mod.id,
                reason: action.handoffReason ?? null,
                at: new Date().toISOString(),
            };
            if (mod.kind === 'studio' && mod.flowFile) {
                const flowPath = (0, path_1.join)(this.configDir(), mod.flowFile);
                const flow = this.flows.loadFromFile(flowPath);
                const entry = mod.entryNode ?? flow.start;
                runtime.enterNormalNode(entry);
                runtime.listenExpectation = null;
                runtime.metadata.moduleNeedsEntrySpeak = true;
            }
            await this.events.persist(runtime.conversationId, 'WORKFLOW_HANDOFF', {
                from: fromModule,
                to: mod.id,
                assistantName: mod.assistantName,
                reason: action.handoffReason ?? null,
                payload: action.handoffPayload ?? null,
                turnNumber: runtime.turn.turnNumber,
                providerCallId: runtime.providerCallId,
            });
            await this.bootstrap.checkpoint(runtime);
        }
        return out;
    }
    async applyContinueTo(runtime, action) {
        const nodeId = action.continueToNodeId.trim();
        const flow = this.flows.getFlow();
        if (!flow.nodes[nodeId]) {
            throw new Error(`continueTo node "${nodeId}" is not in the loaded flow "${flow.id}"`);
        }
        const fromNode = runtime.currentNodeId;
        runtime.enterNormalNode(nodeId);
        runtime.listenExpectation = null;
        runtime.metadata.moduleNeedsEntrySpeak = true;
        runtime.metadata.lastContinueTo = {
            from: fromNode,
            to: nodeId,
            reason: action.handoffReason ?? null,
            at: new Date().toISOString(),
        };
        await this.events.persist(runtime.conversationId, 'FLOW_CONTINUE', {
            from: fromNode,
            to: nodeId,
            reason: action.handoffReason ?? null,
            turnNumber: runtime.turn.turnNumber,
            providerCallId: runtime.providerCallId,
            activeModuleId: runtime.metadata.activeModuleId ?? null,
        });
        await this.bootstrap.checkpoint(runtime);
    }
    /** Load entry module flow for a new Conversation. */
    activateEntryModule(runtime) {
        if (!this.workflows.hasWorkflow())
            return;
        const wf = this.workflows.getWorkflow();
        const mod = this.workflows.getModule(wf.entryModuleId);
        runtime.metadata.workflowId = wf.id;
        runtime.metadata.activeModuleId = mod.id;
        if (mod.kind === 'studio' && mod.flowFile) {
            this.flows.loadFromFile((0, path_1.join)(this.configDir(), mod.flowFile));
        }
    }
    /** Ensure the flow for the runtime's active module is loaded. */
    ensureActiveFlow(runtime) {
        if (!this.workflows.hasWorkflow())
            return;
        const moduleId = typeof runtime.metadata.activeModuleId === 'string'
            ? runtime.metadata.activeModuleId
            : this.workflows.getWorkflow().entryModuleId;
        const mod = this.workflows.getModule(moduleId);
        if (mod.kind === 'studio' && mod.flowFile) {
            const flow = this.flows.loadFromFile((0, path_1.join)(this.configDir(), mod.flowFile));
            // Keep current node if it exists in this flow; else jump to entry.
            if (!runtime.currentNodeId ||
                !flow.nodes[runtime.currentNodeId]) {
                runtime.enterNormalNode(mod.entryNode ?? flow.start);
            }
        }
    }
};
exports.WorkflowHandoffService = WorkflowHandoffService;
exports.WorkflowHandoffService = WorkflowHandoffService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workflow_loader_1.WorkflowLoader,
        flow_loader_1.FlowLoader,
        event_service_1.EventService,
        conversation_bootstrap_service_1.ConversationBootstrapService])
], WorkflowHandoffService);
//# sourceMappingURL=workflow-handoff.service.js.map