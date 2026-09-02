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
  RA9_EVENT_LISTENERS,
  type Ra9EventListener,
} from './events/ra9-event';
import { PostgresEventListener } from './events/postgres-event.listener';
import { BrainUsageTracker } from './brain/brain-usage.tracker';
import { IntegrationClient } from './integrations/integration-client';
import { FlowLoader } from './flow/flow-loader';
import { RA9_NODE_REGISTRY, type Ra9Node, type Ra9NodeRegistry } from './node/ra9-node';
import {
  RA9_INTENTION_REGISTRY,
  type Ra9Intention,
  type Ra9IntentionRegistry,
} from './intention/ra9-intention';
import {
  RA9_BRAIN_CONFIG,
  resolveRa9BrainConfig,
  type Ra9BrainConfig,
} from './brain/brain-config';
import { resolveCheapOpenAiModel } from './brain/openai-cheap-models';
import { ConversationEntity } from './persistence/conversation.entity';
import { ConversationEventEntity } from './persistence/conversation-event.entity';
import { ConversationRepository } from './persistence/conversation.repository';
import { ProviderIngressEntity } from './persistence/provider-ingress.entity';
import { ProviderIngressRepository } from './persistence/provider-ingress.repository';
import { Supervisor } from './supervisor/supervisor';
import { VapiSseCompiler } from './adapters/vapi/vapi-sse.compiler';
import { WorkflowLoader } from './workflow/workflow-loader';
import { WorkflowHandoffService } from './workflow/workflow-handoff.service';
import { FormsService } from './forms/forms.service';
import { FORM_DISPOSE_ADAPTER } from './forms/form.tokens';
import { NoopFormDisposeAdapter } from './forms/noop-form-dispose.adapter';
import type { FormDisposeAdapter } from './forms/form.types';

export interface Ra9ModuleOptions {
  nodes: Array<{ className: string; useClass: Type<Ra9Node<any>> }>;
  /**
   * Optional code intentions (`Ra9Intention`) — cascade meta + before/match/run.
   * Force-phase intentions run before listen resolve / Brain.
   */
  intentions?: Array<Type<Ra9Intention<any>>>;
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
  eventListeners?: Array<Type<Ra9EventListener>>;
  /**
   * Brain settings (model, scan threshold). Code layer — not .env.
   * `model` must be on the cheap whitelist. Default gpt-4.1-nano / 0.4.
   */
  brain?: Ra9BrainConfig;
  /**
   * How to dispose `forms.expose` to the active channel.
   * Default: noop (ACK never arrives → Nodes fall back to voice).
   * Studio registers `ra9-developer-tools-chat`.
   */
  formDisposeAdapter?: Type<FormDisposeAdapter>;
}

@Module({})
export class Ra9Module {
  static forRoot(options: Ra9ModuleOptions): DynamicModule {
    const nodeProviders: Provider[] = options.nodes.map((n) => n.useClass);
    const intentionDefs = options.intentions ?? [];
    const intentionProviders: Provider[] = intentionDefs.map((c) => c);
    const BrainAdapterClass = options.brainAdapter ?? MockBrainAdapter;
    const extraListeners = options.eventListeners ?? [];
    const brainConfig = resolveRa9BrainConfig(options.brain);
    resolveCheapOpenAiModel(brainConfig.model);
    const FormDisposeClass =
      options.formDisposeAdapter ?? NoopFormDisposeAdapter;

    const registryProvider: Provider = {
      provide: RA9_NODE_REGISTRY,
      useFactory: (...instances: Array<Ra9Node<any>>): Ra9NodeRegistry => {
        const map: Ra9NodeRegistry = new Map();
        options.nodes.forEach((def, index) => {
          map.set(def.className, instances[index]);
        });
        return map;
      },
      inject: options.nodes.map((n) => n.useClass),
    };

    const intentionRegistryProvider: Provider = {
      provide: RA9_INTENTION_REGISTRY,
      useFactory: (
        ...instances: Array<Ra9Intention<any>>
      ): Ra9IntentionRegistry => {
        const map: Ra9IntentionRegistry = new Map();
        for (const instance of instances) {
          if (!instance?.name) {
            throw new Error('Ra9Intention subclass is missing readonly name');
          }
          if (map.has(instance.name)) {
            throw new Error(`Duplicate Ra9Intention name: ${instance.name}`);
          }
          map.set(instance.name, instance);
        }
        return map;
      },
      inject: intentionDefs,
    };

    return {
      module: Ra9Module,
      global: true,
      imports: [
        TypeOrmModule.forFeature([
          ConversationEntity,
          ConversationEventEntity,
          ProviderIngressEntity,
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
        { provide: RA9_BRAIN_CONFIG, useValue: brainConfig },
        SupervisedConversationRegistry,
        ConversationRepository,
        ProviderIngressRepository,
        PostgresEventListener,
        ...extraListeners,
        {
          provide: RA9_EVENT_LISTENERS,
          useFactory: (...listeners: Ra9EventListener[]) => listeners,
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
        RA9_BRAIN_CONFIG,
        SupervisedConversationRegistry,
        ConversationRepository,
        ProviderIngressRepository,
        EventService,
        IntegrationClient,
        BrainUsageTracker,
        ConversationBootstrapService,
        ConversationResumeService,
        Supervisor,
        VapiSseCompiler,
        CallTurnQueueRegistry,
        RA9_NODE_REGISTRY,
        RA9_INTENTION_REGISTRY,
        CONVERSATION_ENTRY_POINT,
        RA9_EVENT_LISTENERS,
        WorkflowLoader,
        WorkflowHandoffService,
        FormsService,
        FORM_DISPOSE_ADAPTER,
      ],
    };
  }
}
