export { STANDARD_INTENTIONS } from './intentions/standard-intentions';
export type { StandardIntention } from './intentions/standard-intentions';

export { Ra9Module, Ra9Module as VapiStudioModule } from './ra9.module';
export type { Ra9ModuleOptions, Ra9ModuleOptions as VapiStudioModuleOptions } from './ra9.module';

export {
  Ra9Node,
  Ra9Node as AgentNode,
  conversationViewFromRuntime,
  nodeContextFromRuntime,
} from './node/ra9-node';
export type {
  NodeContext,
  ConversationView,
  Ra9NodeRegistry,
} from './node/ra9-node';
export { RA9_NODE_REGISTRY } from './node/ra9-node';

export {
  Ra9Intention,
  Ra9Intention as CodeIntention,
  intentionContextFromRuntime,
  RA9_INTENTION_REGISTRY,
} from './intention/ra9-intention';
export type {
  IntentionCascadePhase,
  IntentionContext,
  IntentionRunResult,
  Ra9IntentionRegistry,
} from './intention/ra9-intention';

export {
  restartNode,
  forceIntention,
  catchResult,
  rethrowCatch,
  FlowUncertainError,
} from './node/catch-directive';
export type { CatchDirective } from './node/catch-directive';

export {
  BufferedConversationOutput,
} from './output/conversation-output';
export type {
  ConversationOutput,
  NodeResult,
  OutputAction,
  OutputKind,
  ToolCallRequest,
} from './output/conversation-output';

export { SupervisedConversation } from './conversation/supervised-conversation';
export { SupervisedConversationRegistry } from './conversation/supervised-conversation.registry';
export {
  CallTurnQueue,
  CallTurnQueueRegistry,
  coalesceUserUtterances,
} from './conversation/call-turn-queue';
export type { TurnQueueWorkMeta } from './conversation/call-turn-queue';
export { ConversationBootstrapService } from './conversation/conversation-bootstrap.service';
export {
  ConversationResumeService,
  DEFAULT_RESUME_WITHIN_MS,
} from './conversation/conversation-resume.service';
export type { ResumePeekResult } from './conversation/conversation-resume.service';
export {
  CONVERSATION_ENTRY_POINT,
  DefaultConversationEntry,
} from './conversation/conversation-entry';
export type {
  Variables,
  ConversationEntryPoint,
  ConversationEntryInput,
  ConversationHookContext,
} from './conversation/conversation-entry';
export type {
  ConversationSchema,
  DefaultConversationSchema,
  SchemaVariables,
  SchemaMemory,
} from './conversation/conversation-schema';
export {
  DEFAULT_INTENTION_PRIORITY,
  emptyConversationHistory,
  appendChat,
  appendNodeVisit,
  countNodeVisits,
  lastVisitedNodeId,
  compactText,
} from './conversation/conversation-history';
export type {
  ConversationHistory,
  CompactChatMessage,
  NodeVisit,
} from './conversation/conversation-history';
export type {
  ConversationStatus,
  IntentionCandidate,
  PortalState,
  SupervisedStatus,
  TurnState,
} from './conversation/types';

export { Supervisor } from './supervisor/supervisor';
export type { TurnExecutionResult } from './supervisor/supervisor';

export { FlowLoader, CONDITION_GOTO_PREFIX, conditionGotoIntention, parseConditionGotoNodeId } from './flow/flow-loader';
export type {
  FlowDefinition,
  FlowNodeDefinition,
  RawFlowFile,
  CompiledConditionTransition,
} from './flow/flow-loader';
export {
  compileCondition,
  evaluateCondition,
} from './flow/condition';
export type {
  ConditionContext,
  FlowConditionTransition,
} from './flow/condition';

export {
  BRAIN_SERVICE,
  BRAIN_ADAPTER,
  MockBrainAdapter,
  MockBrainService,
  ChatGptBrainAdapter,
} from './brain/brain.service';
export type {
  BrainService,
  BrainAdapter,
  BrainScanInput,
  BrainScanResult,
} from './brain/brain.service';
export { BrainUsageTracker } from './brain/brain-usage.tracker';
export type {
  BrainUsageRecord,
  BrainUsageSummary,
  BrainCallKind,
} from './brain/brain-usage.tracker';
export {
  DEFAULT_CHEAP_OPENAI_MODEL,
  CHEAP_OPENAI_MODELS,
  CHEAP_OPENAI_MODEL_IDS,
  resolveCheapOpenAiModel,
  isCheapOpenAiModel,
  estimateUsdCost,
} from './brain/openai-cheap-models';
export type {
  CheapOpenAiModelId,
  CheapModelPricing,
} from './brain/openai-cheap-models';
export { RA9_BRAIN_CONFIG, resolveRa9BrainConfig } from './brain/brain-config';
export type { Ra9BrainConfig } from './brain/brain-config';
export { detectUserSpeechSeries } from './brain/adapters/chatgpt-brain.adapter';
export {
  clarifiableInputToString,
  filterClarifyAnswer,
  emptyAnswerFromInterface,
  normalizeClarifyResult,
  throwClarifyCannotAnswer,
  isClarifyCannotAnswerError,
  ClarifyCannotAnswerError,
  RA9_CLARIFY_CANNOT_ANSWER,
} from './brain/brain-clarify';
export type {
  ClarifiableInput,
  BrainAnswerField,
  BrainAnswerInterface,
  BrainClarifyRequest,
  BrainClarifyResult,
} from './brain/brain-clarify';
export {
  DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD,
  judgeContextToString,
  normalizeJudgeResult,
  normalizeReasoning,
  clampConfidence,
  formatConfidence6,
  isConfidence6,
  CONFIDENCE_6_PATTERN,
  resolveJudgeConfidenceThreshold,
} from './brain/brain-judge';
export type {
  BrainJudgeRequest,
  BrainJudgeOptions,
  BrainJudgeResult,
  Confidence6,
} from './brain/brain-judge';
export {
  DEFAULT_BRAIN_CONFIDENCE_THRESHOLD,
  CONFIDENCE_DECIMALS,
  allBelowConfidenceThreshold,
  resolveConfidenceThreshold,
  roundConfidence,
  clamp01,
  scoresToRankedCandidates,
  compareIntentionWalkOrder,
  orderIntentionsForWalk,
  selectWalkableIntentions,
  resolveIntentionPriority,
} from './brain/brain-ranking';
export type {
  BrainIntentionOption,
  RankedIntentionScore,
} from './brain/brain-ranking';

export {
  applyListenBoosts,
  mergeSayAndListenOptions,
  missingRequiredExtractKeys,
  mockExtractFromUserText,
  mockExtractPersonName,
  tryResolveListenIntention,
} from './conversation/listen-expectation';
export type {
  ListenExpectation,
  ListenIntentionBoost,
  ListenExtractField,
  ListenExtractSpec,
  ListenExtractHandler,
  ListenExtractApplyContext,
  ListenResolveIntention,
  SayAndListenOptions,
} from './conversation/listen-expectation';
export {
  DEFAULT_LISTEN_TIMEOUT_SECONDS,
  MIN_LISTEN_TIMEOUT_SECONDS,
  MAX_LISTEN_TIMEOUT_SECONDS,
  clampListenTimeoutSeconds,
  resolveListenTimeoutSeconds,
  listenTimeoutSecondsToMs,
  listenTimeoutToVapiStartSpeakingPlan,
} from './conversation/listen-timeout';
export type { VapiStartSpeakingPlanFromListenTimeout } from './conversation/listen-timeout';

export { EventService } from './events/event.service';
export {
  RA9_EVENT_LISTENERS,
  RA9_EVENTS,
} from './events/ra9-event';
export type {
  Ra9Event,
  Ra9EventInput,
  Ra9EventListener,
  Ra9EventType,
} from './events/ra9-event';
export { PostgresEventListener } from './events/postgres-event.listener';
export {
  printConversationConsole,
  snapshotUserMemory,
  isConversationConsoleEnabled,
} from './events/conversation-console';
export type { Ra9LogLevel } from './events/conversation-console';
export {
  beginCallLog,
  appendDailyLog,
  formatCallLogHeader,
  dailyLogFileName,
  logYmd,
  resolveLogDays,
  resolveLogDir,
  shouldPurgeDailyFile,
  purgeOldDailyLogs,
  flushDailyLog,
  resetDailyLogState,
  rememberCallerPhone,
  stripAnsi,
  isFileLogEnabled,
} from './events/daily-log.driver';
export { ConversationEntity } from './persistence/conversation.entity';
export { ConversationEventEntity } from './persistence/conversation-event.entity';
export { ConversationRepository, extractCallerIdFromBags } from './persistence/conversation.repository';
export type { ResumableConversation } from './persistence/conversation.repository';
export { ProviderIngressEntity } from './persistence/provider-ingress.entity';
export { ProviderIngressRepository } from './persistence/provider-ingress.repository';

export { IntegrationClient } from './integrations/integration-client';
export type {
  IntegrationRequest,
  IntegrationResponse,
  IntegrationRequestMeta,
  IntegrationHttpMethod,
} from './integrations/integration-client';
export {
  INTEGRATION_SIGNATURE_HEADER,
  signHs256Jwt,
  verifyHs256Jwt,
  signIntegrationRequest,
  sha256Hex,
  canonicalRequestBody,
  readSecretEnv,
} from './integrations/jwt-hmac';
export type { IntegrationJwtClaims } from './integrations/jwt-hmac';

export {
  VapiSseCompiler,
  extractNewestUserText,
  extractVapiCallId,
  extractVapiCallerNumber,
  extractToolFunctionNames,
  resolveEndCallToolName,
  resolveTransferCallToolName,
  resolveHandoffToolName,
  buildVapiHandoffToolArgs,
  hasAdvertisedHandoffTool,
} from './adapters/vapi/vapi-sse.compiler';
export type { VapiStreamWriter, VapiToolLike } from './adapters/vapi/vapi-sse.compiler';

export {
  extractAdvertisedTools,
  extractToolResults,
  channelToolsApiFromList,
  CHANNEL_META,
} from './channel/channel-tools';
export type {
  ChannelTool,
  ChannelToolResult,
  ChannelToolsApi,
  VapiTurnContext,
} from './channel/channel-tools';

export { WorkflowLoader } from './workflow/workflow-loader';
export type {
  WorkflowDefinition,
  WorkflowModuleDefinition,
  WorkflowModuleKind,
} from './workflow/workflow-loader';
export { WorkflowHandoffService } from './workflow/workflow-handoff.service';

export { FormsService } from './forms/forms.service';
export { FORM_DISPOSE_ADAPTER } from './forms/form.tokens';
export { NoopFormDisposeAdapter } from './forms/noop-form-dispose.adapter';
export {
  renderFormHtml,
  renderFormThanksHtml,
  renderFormGoneHtml,
} from './forms/form-html';
export type { RenderFormHtmlOptions } from './forms/form-html';
export type {
  FormFieldType,
  FormFieldSpec,
  FormExposeSpec,
  FormValues,
  FormExposeHandle,
  FormDisposePayload,
  FormDisposeAdapter,
} from './forms/form.types';
export {
  FormDeliverTimeoutError,
  FormFilloutTimeoutError,
  FormChannelUnavailableError,
} from './forms/form.types';
