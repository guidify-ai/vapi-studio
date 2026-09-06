/**
 * Landing-page Planner LLM — design the customer's future Vapi Studio agent.
 * Not a roof-estimate / SMS-form product path.
 */

export type PlannerUseCase =
  | 'qualify'
  | 'book'
  | 'faq'
  | 'dispatch'
  | 'other';

export type IntegrationInterest = 'none' | 'crm' | 'tools' | 'unknown';

export type DesignDraft = {
  funnels: Array<{ id: string; label: string }>;
  analyticsEvents: string[];
  flowNodes: Array<{ id: string; label: string; kind?: string }>;
  sampleConversation: string;
  portals?: string[];
};

export type PlannerMemory = {
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  companyDoes?: string;
  useCase?: PlannerUseCase;
  discoveryAnswers?: string[];
  discoveryComplete?: boolean;
  integrationInterest?: IntegrationInterest;
  designDraft?: DesignDraft;
  sampleShown?: boolean;
  offerHelp?: boolean;
  quoteRequested?: boolean;
  correctionCount?: number;
  madStrikes?: number;
  /** Outbound phone sample path (not the full web planner). */
  outboundDemo?: boolean;
  /** Topic chosen on phone demo: what | cost | not_dev | use_case */
  phoneDemoTopic?: string;
  /** How they heard about Vapi Studio (demo attribution). */
  heardAbout?: string;
  /** Idempotent Resend flags (HOT_LEAD_TO). */
  leadMailSuccessSent?: boolean;
  leadMailQuoteSent?: boolean;
  leadMailTransferSent?: boolean;
};

export type PlannerVariables = {
  companyName: string;
  afterHours?: boolean;
  callerChannel?: string;
  callerId?: string;
  contactName?: string;
  contactEmail?: string;
  guestCompanyName?: string;
  /** True when Vapi outbound “Call me” metadata.outbound is set. */
  outboundDemo?: boolean;
  /** Resolved Studio feature flags for this conversation. */
  featureFlags?: Record<string, boolean>;
};

export type PlannerSchema = {
  variables: PlannerVariables;
  memory: PlannerMemory;
};

export const PLANNER_INTENTIONS = {
  companyDoesCollected: 'company_does_collected',
  useCaseQualify: 'use_case_qualify',
  useCaseBook: 'use_case_book',
  useCaseFaq: 'use_case_faq',
  useCaseDispatch: 'use_case_dispatch',
  useCaseOther: 'use_case_other',
  discoveryAnswer: 'discovery_answer',
  discoveryProceed: 'discovery_proceed',
  integrationsNone: 'integrations_none',
  integrationsCrm: 'integrations_crm',
  integrationsTools: 'integrations_tools',
  sampleOk: 'sample_ok',
  sampleTweak: 'sample_tweak',
  helpBuild: 'help_build',
  productFaq: 'product_faq',
  nothingElse: 'nothing_else',
  isContinue: 'isContinue',
  phoneDemoWhat: 'phone_demo_what',
  phoneDemoCost: 'phone_demo_cost',
  phoneDemoNotDev: 'phone_demo_not_dev',
  phoneDemoClarify: 'phone_demo_clarify',
  phoneDemoUseCase: 'phone_demo_use_case',
  phoneDemoHeardAbout: 'phone_demo_heard_about',
} as const;

export const MAX_DISCOVERY_ANSWERS = 5;
export const MAX_CORRECTIONS = 8;

export const DISCOVERY_QUESTIONS = [
  'What specific facts should the agent get from the caller before it finishes?',
  'When should it transfer to a human — or who is not a fit?',
  'Who typically calls — and what do they usually ask first?',
  'Any tone or brand rules the agent must respect?',
  'Anything else critical before I draft the sample?',
] as const;
