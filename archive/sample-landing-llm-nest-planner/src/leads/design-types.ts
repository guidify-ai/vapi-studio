export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type DesignFlowNode = { id: string; label: string; kind?: string };

export type DesignFunnel = { id: string; label: string; steps: string[] };

export type DesignAnalyticsEvent = {
  tag: string;
  funnelId: string;
  step: string;
  why: string;
};

export type DesignSampleLine = { role: 'bot' | 'caller'; text: string };

/** Public design draft shown in the UI (no private quote fields). */
export type DesignDraftPublic = {
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  companyDoes?: string;
  useCase?: string;
  /** @deprecated prefer companyName — kept for older drafts */
  product?: string;
  vertical?: string;
  desiredResult?: string;
  /** Answers from discovery (what matters to the guest) — max 7. */
  discoveryAnswers?: string[];
  /** True when discovery is done (enough signal, or 7 answers). */
  discoveryComplete?: boolean;
  portals?: string[];
  flowNodes?: DesignFlowNode[];
  funnels?: DesignFunnel[];
  analyticsEvents?: DesignAnalyticsEvent[];
  sampleConversation?: DesignSampleLine[];
  integrationInterest?: string;
  refinementOffer?: string;
  /** When true, UI highlights Help me build it. */
  offerHelp?: boolean;
  /** Plan corrections applied after the first sample — max 10 per session. */
  correctionCount?: number;
  /** Questions the planner could not answer — also stored for quoting. */
  unansweredQuestions?: string[];
  /** Guest declined further help — stop re-asking the open question. */
  declinedMoreHelp?: boolean;
  /** Spoken brand token for sample greeting (e.g. GreenLeaf vs legal name). */
  spokenBrand?: string;
  /** Persisted caller-open hook from corrections (e.g. overgrown backyard). */
  sampleCallerHook?: string;
};

/** PRIVATE — persisted for Guidify; never returned on design/turn API. */
export type PrivateQuote = {
  complexity?: string;
  quoteHours?: number;
  baseHours?: number;
  integrationHours?: number;
  integrationKind?: 'none' | 'common' | 'custom' | string;
  integrationNotes?: string;
  rationale?: string;
  /** Planner may set true when the session is worth Guidify attention. */
  hotLead?: boolean;
  /** Short Guidify-only reason for the hot-lead email. */
  hotLeadReason?: string;
  /** Guest questions with no KB/LLM answer — Guidify follow-up. */
  unansweredQuestions?: string[];
};
