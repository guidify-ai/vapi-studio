"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var VapiStudioModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VapiStudioModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const brain_service_1 = require("./brain/brain.service");
const conversation_bootstrap_service_1 = require("./conversation/conversation-bootstrap.service");
const conversation_resume_service_1 = require("./conversation/conversation-resume.service");
const conversation_entry_1 = require("./conversation/conversation-entry");
const supervised_conversation_registry_1 = require("./conversation/supervised-conversation.registry");
const call_turn_queue_1 = require("./conversation/call-turn-queue");
const event_service_1 = require("./events/event.service");
const studio_event_1 = require("./events/studio-event");
const postgres_event_listener_1 = require("./events/postgres-event.listener");
const brain_usage_tracker_1 = require("./brain/brain-usage.tracker");
const integration_client_1 = require("./integrations/integration-client");
const flow_loader_1 = require("./flow/flow-loader");
const agent_node_1 = require("./node/agent-node");
const code_intention_1 = require("./intention/code-intention");
const brain_config_1 = require("./brain/brain-config");
const conversation_limits_1 = require("./conversation/conversation-limits");
const conversation_entity_1 = require("./persistence/conversation.entity");
const conversation_event_entity_1 = require("./persistence/conversation-event.entity");
const conversation_repository_1 = require("./persistence/conversation.repository");
const provider_ingress_entity_1 = require("./persistence/provider-ingress.entity");
const provider_ingress_repository_1 = require("./persistence/provider-ingress.repository");
const project_entity_1 = require("./persistence/project.entity");
const project_repository_1 = require("./persistence/project.repository");
const supervisor_1 = require("./supervisor/supervisor");
const vapi_sse_compiler_1 = require("./adapters/vapi/vapi-sse.compiler");
const workflow_loader_1 = require("./workflow/workflow-loader");
const workflow_handoff_service_1 = require("./workflow/workflow-handoff.service");
const forms_service_1 = require("./forms/forms.service");
const form_tokens_1 = require("./forms/form.tokens");
const noop_form_dispose_adapter_1 = require("./forms/noop-form-dispose.adapter");
let VapiStudioModule = VapiStudioModule_1 = class VapiStudioModule {
    static forRoot(options) {
        const nodeProviders = options.nodes.map((n) => n.useClass);
        const intentionDefs = options.intentions ?? [];
        const intentionProviders = intentionDefs.map((c) => c);
        const BrainAdapterClass = options.brainAdapter ?? brain_service_1.MockBrainAdapter;
        const extraListeners = options.eventListeners ?? [];
        const brainConfig = (0, brain_config_1.resolveStudioBrainConfig)(options.brain);
        const conversationLimits = (0, conversation_limits_1.resolveConversationLimits)(options.limits);
        const FormDisposeClass = options.formDisposeAdapter ?? noop_form_dispose_adapter_1.NoopFormDisposeAdapter;
        const registryProvider = {
            provide: agent_node_1.STUDIO_NODE_REGISTRY,
            useFactory: (...instances) => {
                const map = new Map();
                options.nodes.forEach((def, index) => {
                    map.set(def.className, instances[index]);
                });
                return map;
            },
            inject: options.nodes.map((n) => n.useClass),
        };
        const intentionRegistryProvider = {
            provide: code_intention_1.STUDIO_INTENTION_REGISTRY,
            useFactory: (...instances) => {
                const map = new Map();
                for (const instance of instances) {
                    if (!instance?.name) {
                        throw new Error('CodeIntention subclass is missing readonly name');
                    }
                    if (map.has(instance.name)) {
                        throw new Error(`Duplicate CodeIntention name: ${instance.name}`);
                    }
                    map.set(instance.name, instance);
                }
                return map;
            },
            inject: intentionDefs,
        };
        return {
            module: VapiStudioModule_1,
            global: true,
            imports: [
                typeorm_1.TypeOrmModule.forFeature([
                    conversation_entity_1.ConversationEntity,
                    conversation_event_entity_1.ConversationEventEntity,
                    provider_ingress_entity_1.ProviderIngressEntity,
                    project_entity_1.ProjectEntity,
                ]),
            ],
            providers: [
                ...nodeProviders,
                ...intentionProviders,
                registryProvider,
                intentionRegistryProvider,
                {
                    provide: conversation_entry_1.CONVERSATION_ENTRY_POINT,
                    useClass: options.entryPoint ?? conversation_entry_1.DefaultConversationEntry,
                },
                flow_loader_1.FlowLoader,
                BrainAdapterClass,
                { provide: brain_service_1.BRAIN_SERVICE, useExisting: BrainAdapterClass },
                { provide: brain_config_1.STUDIO_BRAIN_CONFIG, useValue: brainConfig },
                { provide: conversation_limits_1.STUDIO_CONVERSATION_LIMITS, useValue: conversationLimits },
                supervised_conversation_registry_1.SupervisedConversationRegistry,
                conversation_repository_1.ConversationRepository,
                provider_ingress_repository_1.ProviderIngressRepository,
                project_repository_1.ProjectRepository,
                postgres_event_listener_1.PostgresEventListener,
                ...extraListeners,
                {
                    provide: studio_event_1.STUDIO_EVENT_LISTENERS,
                    useFactory: (...listeners) => listeners,
                    inject: [postgres_event_listener_1.PostgresEventListener, ...extraListeners],
                },
                event_service_1.EventService,
                integration_client_1.IntegrationClient,
                brain_usage_tracker_1.BrainUsageTracker,
                conversation_bootstrap_service_1.ConversationBootstrapService,
                conversation_resume_service_1.ConversationResumeService,
                supervisor_1.Supervisor,
                vapi_sse_compiler_1.VapiSseCompiler,
                call_turn_queue_1.CallTurnQueueRegistry,
                workflow_loader_1.WorkflowLoader,
                workflow_handoff_service_1.WorkflowHandoffService,
                FormDisposeClass,
                { provide: form_tokens_1.FORM_DISPOSE_ADAPTER, useExisting: FormDisposeClass },
                forms_service_1.FormsService,
            ],
            exports: [
                flow_loader_1.FlowLoader,
                BrainAdapterClass,
                brain_service_1.BRAIN_SERVICE,
                brain_config_1.STUDIO_BRAIN_CONFIG,
                conversation_limits_1.STUDIO_CONVERSATION_LIMITS,
                supervised_conversation_registry_1.SupervisedConversationRegistry,
                conversation_repository_1.ConversationRepository,
                provider_ingress_repository_1.ProviderIngressRepository,
                project_repository_1.ProjectRepository,
                event_service_1.EventService,
                integration_client_1.IntegrationClient,
                brain_usage_tracker_1.BrainUsageTracker,
                conversation_bootstrap_service_1.ConversationBootstrapService,
                conversation_resume_service_1.ConversationResumeService,
                supervisor_1.Supervisor,
                vapi_sse_compiler_1.VapiSseCompiler,
                call_turn_queue_1.CallTurnQueueRegistry,
                agent_node_1.STUDIO_NODE_REGISTRY,
                code_intention_1.STUDIO_INTENTION_REGISTRY,
                conversation_entry_1.CONVERSATION_ENTRY_POINT,
                studio_event_1.STUDIO_EVENT_LISTENERS,
                workflow_loader_1.WorkflowLoader,
                workflow_handoff_service_1.WorkflowHandoffService,
                forms_service_1.FormsService,
                form_tokens_1.FORM_DISPOSE_ADAPTER,
            ],
        };
    }
};
exports.VapiStudioModule = VapiStudioModule;
exports.VapiStudioModule = VapiStudioModule = VapiStudioModule_1 = __decorate([
    (0, common_1.Module)({})
], VapiStudioModule);
//# sourceMappingURL=vapi-studio.module.js.map