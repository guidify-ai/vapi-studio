import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  BRAIN_SERVICE,
  ChatGptBrainAdapter,
  ClaudeBrainAdapter,
  GeminiBrainAdapter,
  GrokBrainAdapter,
  MockBrainAdapter,
  MockChatGptBrainAdapter,
  MockClaudeBrainAdapter,
  MockGeminiBrainAdapter,
  MockGrokBrainAdapter,
  ConversationEntity,
  ConversationEventEntity,
  FlowLoader,
  ProjectEntity,
  ProviderIngressEntity,
  VapiStudioModule,
  WorkflowLoader,
  StudioUiModule,
  type BrainAdapter,
} from '@guidify-ai/vapi-studio';
import { HealthController } from './health/health.controller';
import { FlowDiagramController } from './flow-diagram/flow-diagram.controller';
import { FlowDiagramService } from './flow-diagram/flow-diagram.service';
import { ConversationsController } from './conversations/conversations.controller';
import { ConversationsService } from './conversations/conversations.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { StudioController } from './studio/studio.controller';
import { StudioSessionService } from './studio/studio-session.service';
import { StudioEventBuffer } from './studio/studio-event-buffer';
import { StudioLiveSpeechBuffer } from './studio/studio-live-speech.buffer';
import { FormResumeService } from './forms/form-resume.service';
import { CallerPersistenceModule } from './caller/caller-persistence.module';
import { CallerProfileEntity } from './caller/caller-profile.entity';
import { ProjectSeedService } from './project/project-seed.service';
import { ProjectUuidGuard } from './project/project-uuid.guard';
import { VapiController } from './vapi/vapi.controller';
import { VapiWebhookGuard } from './vapi/vapi.guard';
import { VapiWebhookHandler } from './vapi/vapi.handler';
import { VapiStrategyTriager } from './vapi/vapi.triager';
import { AssistantRequestStrategy } from './vapi/strategies/assistant-request.strategy';
import { CallStartedStrategy } from './vapi/strategies/call-started.strategy';
import { StatusUpdateStrategy } from './vapi/strategies/status-update.strategy';
import { UserInterruptedStrategy } from './vapi/strategies/user-interrupted.strategy';
import { ToolCallsStrategy } from './vapi/strategies/tool-calls.strategy';
import { PlannerConversationEntry } from './conversation/entry';
import {
  AcknowledgeNode,
  PhoneDemoLeadNode,
  PhoneDemoHeardAboutNode,
  PhoneDemoWhatNode,
  PhoneDemoCostNode,
  PhoneDemoNotDevNode,
  PhoneDemoWhatIntention,
  PhoneDemoCostIntention,
  PhoneDemoNotDevIntention,
  PhoneDemoClarifyIntention,
  PhoneDemoUseCaseIntention,
  PhoneDemoHeardAboutIntention,
} from './conversation/nodes/planner/phone-demo.nodes';
import {
  GoodbyeNode,
  ContinueNode,
  MadNode,
  StillThereNode,
  TransferToHumanNode,
  UnknownTransitionNode,
} from './conversation/nodes/portals.nodes';
import {
  MadDetectIntention,
  GibberishDetectIntention,
  SoftContinueIntention,
  NothingElseIntention,
} from './conversation/intentions/planner.intentions';
import { brainConfig } from './brain/brain.config';
import { PlannerMailModule } from './mail/planner-mail.module';
import { OutboundCallService } from './studio/outbound-call.service';

function resolveBrainAdapter() {
  switch (brainConfig.adapter) {
    case 'studio-chatgpt':
      return ChatGptBrainAdapter;
    case 'studio-claude':
      return ClaudeBrainAdapter;
    case 'studio-gemini':
      return GeminiBrainAdapter;
    case 'studio-grok':
      return GrokBrainAdapter;
    case 'mock-claude':
      return MockClaudeBrainAdapter;
    case 'mock-gemini':
      return MockGeminiBrainAdapter;
    case 'mock-grok':
      return MockGrokBrainAdapter;
    case 'mock':
    case 'mock-chatgpt':
    default:
      return MockChatGptBrainAdapter;
  }
}

@Module({
  imports: [
    PlannerMailModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url:
        process.env.DATABASE_URL ??
        'postgres://studio:studio@postgres:5432/studio',
      entities: [
        ConversationEntity,
        ConversationEventEntity,
        ProviderIngressEntity,
        ProjectEntity,
        CallerProfileEntity,
      ],
      synchronize: true,
    }),
    CallerPersistenceModule,
    StudioUiModule.forRoot(),
    VapiStudioModule.forRoot({
      entryPoint: PlannerConversationEntry,
      brainAdapter: resolveBrainAdapter(),
      eventListeners: [StudioEventBuffer],
      brain: {
        model: brainConfig.model,
        confidenceThreshold: brainConfig.confidenceThreshold,
      },
      intentions: [
        MadDetectIntention,
        GibberishDetectIntention,
        SoftContinueIntention,
        NothingElseIntention,
        PhoneDemoWhatIntention,
        PhoneDemoCostIntention,
        PhoneDemoNotDevIntention,
        PhoneDemoClarifyIntention,
        PhoneDemoUseCaseIntention,
        PhoneDemoHeardAboutIntention,
      ],
      nodes: [
        { className: 'AcknowledgeNode', useClass: AcknowledgeNode },
        { className: 'PhoneDemoWhatNode', useClass: PhoneDemoWhatNode },
        { className: 'PhoneDemoCostNode', useClass: PhoneDemoCostNode },
        { className: 'PhoneDemoNotDevNode', useClass: PhoneDemoNotDevNode },
        { className: 'PhoneDemoLeadNode', useClass: PhoneDemoLeadNode },
        {
          className: 'PhoneDemoHeardAboutNode',
          useClass: PhoneDemoHeardAboutNode,
        },
        { className: 'GoodbyeNode', useClass: GoodbyeNode },
        { className: 'ContinueNode', useClass: ContinueNode },
        { className: 'MadNode', useClass: MadNode },
        { className: 'UnknownTransitionNode', useClass: UnknownTransitionNode },
        { className: 'TransferToHumanNode', useClass: TransferToHumanNode },
        { className: 'StillThereNode', useClass: StillThereNode },
      ],
    }),
  ],
  controllers: [
    HealthController,
    FlowDiagramController,
    ConversationsController,
    AnalyticsController,
    StudioController,
    VapiController,
  ],
  providers: [
    FlowDiagramService,
    ConversationsService,
    AnalyticsService,
    StudioEventBuffer,
    StudioLiveSpeechBuffer,
    StudioSessionService,
    OutboundCallService,
    FormResumeService,
    ProjectSeedService,
    ProjectUuidGuard,
    VapiWebhookGuard,
    VapiWebhookHandler,
    VapiStrategyTriager,
    AssistantRequestStrategy,
    CallStartedStrategy,
    StatusUpdateStrategy,
    UserInterruptedStrategy,
    ToolCallsStrategy,
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private readonly flowLoader: FlowLoader,
    private readonly workflows: WorkflowLoader,
    @Inject(BRAIN_SERVICE) private readonly brain: BrainAdapter,
  ) {}

  async onModuleInit(): Promise<void> {
    const configDir = process.env.CONFIG_DIR ?? join(process.cwd(), 'config');
    const squadPath = join(configDir, 'workflow.yaml');
    if (existsSync(squadPath)) {
      this.workflows.loadFromFile(squadPath);
    }
    if (this.workflows.hasWorkflow()) {
      const wf = this.workflows.getWorkflow();
      const entry = this.workflows.getModule(wf.entryModuleId);
      if (entry.kind === 'studio' && entry.flowFile) {
        this.flowLoader.loadFromFile(join(configDir, entry.flowFile));
      } else {
        this.flowLoader.loadFromFile(join(configDir, 'flow.yaml'));
      }
      this.logger.log(
        `Workflow ${wf.id} entry=${wf.entryModuleId} modules=${Object.keys(wf.modules).join(',')}`,
      );
    } else {
      this.flowLoader.loadFromFile(join(configDir, 'flow.yaml'));
      this.logger.log(
        'Planner sample: config/flow.yaml (Landing Page Planner LLM)',
      );
    }

    this.logger.log(
      `Brain driver=${brainConfig.adapter} model=${brainConfig.model} threshold=${brainConfig.confidenceThreshold}`,
    );

    if (this.brain instanceof MockBrainAdapter) {
      this.brain.loadProfile(
        'planner',
        join(configDir, 'poc', 'planner.brain.yml'),
      );
      this.brain.loadProfile(
        'state-machine',
        join(configDir, 'poc', 'state-machine.brain.yml'),
      );
      this.brain.loadProfile(
        'transfer-human',
        join(configDir, 'poc', 'transfer-human.brain.yml'),
      );
      this.brain.loadProfile(
        'pause-resume',
        join(configDir, 'poc', 'pause-resume.brain.yml'),
      );
      const profile = process.env.POC_BRAIN_PROFILE ?? 'planner';
      this.brain.setActiveProfile(profile);
    }
  }
}
