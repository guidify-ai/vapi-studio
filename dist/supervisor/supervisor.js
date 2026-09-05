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
exports.Supervisor = void 0;
const common_1 = require("@nestjs/common");
const brain_service_1 = require("../brain/brain.service");
const brain_config_1 = require("../brain/brain-config");
const conversation_limits_1 = require("../conversation/conversation-limits");
const conversation_bootstrap_service_1 = require("../conversation/conversation-bootstrap.service");
const event_service_1 = require("../events/event.service");
const forms_service_1 = require("../forms/forms.service");
const flow_loader_1 = require("../flow/flow-loader");
const integration_client_1 = require("../integrations/integration-client");
const code_intention_1 = require("../intention/code-intention");
const agent_node_1 = require("../node/agent-node");
const supervisor_engine_1 = require("./supervisor-engine");
/**
 * Nest facade for turn orchestration.
 *
 * Implementation is split across focused modules assembled by
 * `createSupervisorEngine`:
 * - `supervisor-orchestration` — handleTurn / executeTurn
 * - `supervisor-limits` — max turns / duration fail-closed endCall
 * - `supervisor-special-turns` — opening / module entry / tool-result
 * - `supervisor-cascade` — force / match / Brain candidates
 * - `supervisor-route` — walk candidates → node
 * - `supervisor-portal` — continue / unknown-origin consume
 * - `supervisor-node-exec` — listen/run/catch + portal enter/exit
 */
let Supervisor = class Supervisor {
    engine;
    constructor(brain, flowLoader, nodes, events, bootstrap, integrations, forms, brainConfig, intentions, conversationLimits) {
        this.engine = (0, supervisor_engine_1.createSupervisorEngine)({
            brain,
            flowLoader,
            nodes,
            events,
            bootstrap,
            integrations,
            forms,
            brainConfig,
            intentions,
            conversationLimits,
        });
    }
    async handleTurn(input) {
        return this.engine.handleTurn(input);
    }
};
exports.Supervisor = Supervisor;
exports.Supervisor = Supervisor = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(brain_service_1.BRAIN_SERVICE)),
    __param(2, (0, common_1.Inject)(agent_node_1.STUDIO_NODE_REGISTRY)),
    __param(5, (0, common_1.Optional)()),
    __param(6, (0, common_1.Optional)()),
    __param(7, (0, common_1.Optional)()),
    __param(7, (0, common_1.Inject)(brain_config_1.STUDIO_BRAIN_CONFIG)),
    __param(8, (0, common_1.Optional)()),
    __param(8, (0, common_1.Inject)(code_intention_1.STUDIO_INTENTION_REGISTRY)),
    __param(9, (0, common_1.Optional)()),
    __param(9, (0, common_1.Inject)(conversation_limits_1.STUDIO_CONVERSATION_LIMITS)),
    __metadata("design:paramtypes", [Object, flow_loader_1.FlowLoader, Object, event_service_1.EventService,
        conversation_bootstrap_service_1.ConversationBootstrapService,
        integration_client_1.IntegrationClient,
        forms_service_1.FormsService, Object, Object, Object])
], Supervisor);
//# sourceMappingURL=supervisor.js.map