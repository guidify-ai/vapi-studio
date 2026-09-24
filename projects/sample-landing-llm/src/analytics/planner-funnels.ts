/** Explicit milestone tags — stamp via `stampAnalyticsTag`; no payload.funnels. */
export const PLANNER_ANALYTICS_TAGS = {
  plannerStarted: 'planner_started',
  /** LP intro fields accepted into Conversation memory (name / email / company). */
  intakeSeeded: 'intake_seeded',
  companyDoesSet: 'company_does_set',
  useCaseSet: 'use_case_set',
  discoveryComplete: 'discovery_complete',
  sampleShown: 'sample_shown',
  quoteRequested: 'quote_requested',
  transferHuman: 'transfer_human',
  sessionEnded: 'session_ended',
  mad: 'mad',
  unknown: 'unknown',
  phoneDemoStarted: 'phone_demo_started',
  phoneDemoTopic: 'phone_demo_topic',
  phoneDemoHeardAbout: 'phone_demo_heard_about',
} as const;
