import { DynamicModule, Module, type Provider, type Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BRAIN_SERVICE,
  MockBrainAdapter,
  type BrainAdapter,
} from './brain/brain.service';
import { ConversationBootstrapService } from './conversation/conversation-bootstrap.service';
import { ConversationResumeService } from './conversation/conversation-resume.service';
import {
  CONVERSATION_ENTRY_POINT,
  DefaultConversationEntry,
  type ConversationEntryPoint,
} from './conversation/conversation-entry';
import { SupervisedConversationRegistry } from './conversation/supervised-conversation.registry';
import { CallTurnQueueRegistry } from './conversation/call-turn-queue';
import { EventService } from './events/event.service';
import {
  STUDIO_EVENT_LISTENERS,
  type StudioEventListener,
} from './events/studio-event';
import { PostgresEventListener } from './events/postgres-event.listener';
import { BrainUsageTracker } from './brain/brain-usage.tracker';
import { IntegrationClient } from './integrations/integration-client';
import { FlowLoader } from './flow/flow-loader';
import { STUDIO_NODE_REGISTRY, type AgentNode, type AgentNodeRegistry } from './node/agent-node';
import {
  STUDIO_INTENTION_REGISTRY,
  type CodeIntention,
  type CodeIntentionRegistry,
} from './intention/code-intention';
import {
  STUDIO_BRAIN_CONFIG,
  resolveStudioBrainConfig,
  type StudioBrainConfig,
} from './brain/brain-config';
import {
  STUDIO_CONVERSATION_LIMITS,
  resolveConversationLimits,
  type ConversationLimitsConfig,
} from './conversation/conversation-limits';
import { resolveCheapOpenAiModel } from './brain/openai-cheap-models';
import { ConversationEntity } from './persistence/conversation.entity';
import { ConversationEventEntity } from './persistence/conversation-event.entity';
import { ConversationRepository } from './persistence/conversation.repository';
import { ProviderIngressEntity } from './persistence/provider-ingress.entity';
import { ProviderIngressRepository } from './persistence/provider-ingress.repository';
import { ProjectEntity } from './persistence/project.entity';
import { ProjectRepository } from './persistence/project.repository';
import { Supervisor } from './supervisor/supervisor';
import { VapiSseCompiler } from './adapters/vapi/vapi-sse.compiler';
import { WorkflowLoader } from './workflow/workflow-loader';
import { WorkflowHandoffService } from './workflow/workflow-handoff.service';
import { FormsService } from './forms/forms.service';
import { FORM_DISPOSE_ADAPTER } from './forms/form.tokens';
import { NoopFormDisposeAdapter } from './forms/noop-form-dispose.adapter';
import type { FormDisposeAdapter } from './forms/form.types';

export interface VapiStudioModuleOptions {
  nodes: Array<{ className: string; useClass: Type<AgentNode<any>> }>;
  /**
   * Optional code intentions (`CodeIntention`) — cascade meta + before/match/run.
   * Force-phase intentions run before listen resolve / Brain.
   */
  intentions?: Array<Type<CodeIntention<any>>>;
  /**
   * Conversation entry point that seeds typed variables at bootstrap.
   * Defaults to an empty variables object when omitted.
   */
  entryPoint?: Type<ConversationEntryPoint<object>>;
  /**
   * Brain adapter (Mock, ChatGPT, or app-owned e.g. Roofr API).
   * Defaults to MockBrainAdapter. Supervisor depends only on BRAIN_SERVICE.
   */
  brainAdapter?: Type<BrainAdapter>;
  /**
   * Extra event listeners (additive). PostgresEventListener is always registered.
   * App code (e.g. roofr-poc) can append Datadog / webhook listeners here.
   */
  eventListeners?: Array<Type<StudioEventListener>>;
  /**
   * Brain settings (model, scan threshold). Code layer — not .env.
   * `model` must be on the cheap whitelist. Default gpt-4.1-nano / 0.4.
   */
  brain?: StudioBrainConfig;
  /**
   * Hard conversation caps (turns + wall-clock). Always on — defaults 40 turns /
   * 20 minutes. Cannot be disabled; values are clamped to safe ceilings.
   */
  limits?: ConversationLimitsConfig;
  /**
   * How to dispose `forms.expose` to the active channel.
   * Default: noop (ACK never arrives → Nodes fall back to voice).
   * Studio registers a developer-tools chat dispose adapter.
   */
  formDisposeAdapter?: Type<FormDisposeAdapter>;
}

@Module({})
export class VapiStudioModule {
  public static forRoot(options: VapiStudioModuleOptions): DynamicModule {
    const nodeProviders: Provider[] = options.nodes.map((n) => n.useClass);
    const intentionDefs = options.intentions ?? [];
    const intentionProviders: Provider[] = intentionDefs.map((c) => c);
    const BrainAdapterClass = options.brainAdapter ?? MockBrainAdapter;
    const extraListeners = options.eventListeners ?? [];
    const brainConfig = resolveStudioBrainConfig(options.brain);
    resolveCheapOpenAiModel(brainConfig.model);
    const conversationLimits = resolveConversationLimits(options.limits);
    const FormDisposeClass =
      options.formDisposeAdapter ?? NoopFormDisposeAdapter;

    const registryProvider: Provider = {
      provide: STUDIO_NODE_REGISTRY,
      useFactory: (...instances: Array<AgentNode<any>>): AgentNodeRegistry => {
        const map: AgentNodeRegistry = new Map();
        options.nodes.forEach((def, index) => {
          map.set(def.className, instances[index]);
        });
        return map;
      },
      inject: options.nodes.map((n) => n.useClass),
    };

    const intentionRegistryProvider: Provider = {
      provide: STUDIO_INTENTION_REGISTRY,
      useFactory: (
        ...instances: Array<CodeIntention<any>>
      ): CodeIntentionRegistry => {
        const map: CodeIntentionRegistry = new Map();
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
      module: VapiStudioModule,
      global: true,
      imports: [
        TypeOrmModule.forFeature([
          ConversationEntity,
          ConversationEventEntity,
          ProviderIngressEntity,
          ProjectEntity,
        ]),
      ],
      providers: [
        ...nodeProviders,
        ...intentionProviders,
        registryProvider,
        intentionRegistryProvider,
        {
          provide: CONVERSATION_ENTRY_POINT,
          useClass: options.entryPoint ?? DefaultConversationEntry,
        },
        FlowLoader,
        BrainAdapterClass,
        { provide: BRAIN_SERVICE, useExisting: BrainAdapterClass },
        { provide: STUDIO_BRAIN_CONFIG, useValue: brainConfig },
        { provide: STUDIO_CONVERSATION_LIMITS, useValue: conversationLimits },
        SupervisedConversationRegistry,
        ConversationRepository,
        ProviderIngressRepository,
        ProjectRepository,
        PostgresEventListener,
        ...extraListeners,
        {
          provide: STUDIO_EVENT_LISTENERS,
          useFactory: (...listeners: StudioEventListener[]) => listeners,
          inject: [PostgresEventListener, ...extraListeners],
        },
        EventService,
        IntegrationClient,
        BrainUsageTracker,
        ConversationBootstrapService,
        ConversationResumeService,
        Supervisor,
        VapiSseCompiler,
        CallTurnQueueRegistry,
        WorkflowLoader,
        WorkflowHandoffService,
        FormDisposeClass,
        { provide: FORM_DISPOSE_ADAPTER, useExisting: FormDisposeClass },
        FormsService,
      ],
      exports: [
        FlowLoader,
        BrainAdapterClass,
        BRAIN_SERVICE,
        STUDIO_BRAIN_CONFIG,
        STUDIO_CONVERSATION_LIMITS,
        SupervisedConversationRegistry,
        ConversationRepository,
        ProviderIngressRepository,
        ProjectRepository,
        EventService,
        IntegrationClient,
        BrainUsageTracker,
        ConversationBootstrapService,
        ConversationResumeService,
        Supervisor,
        VapiSseCompiler,
        CallTurnQueueRegistry,
        STUDIO_NODE_REGISTRY,
        STUDIO_INTENTION_REGISTRY,
        CONVERSATION_ENTRY_POINT,
        STUDIO_EVENT_LISTENERS,
        WorkflowLoader,
        WorkflowHandoffService,
        FormsService,
        FORM_DISPOSE_ADAPTER,
      ],
    };
  }
}
