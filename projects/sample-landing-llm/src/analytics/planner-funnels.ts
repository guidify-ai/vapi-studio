import type { AnalyticsFunnelDefinition } from '@guidify-ai/vapi-studio';

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

export const PLANNER_FUNNELS: AnalyticsFunnelDefinition[] = [
  {
    id: 'planner_design',
    label: 'Planner design path',
    description:
      'Landing planner: open → use case → discovery → sample → Help me build it.',
    steps: [
      {
        id: 'use_case_set',
        label: 'Use case set',
        tags: [PLANNER_ANALYTICS_TAGS.useCaseSet],
      },
      {
        id: 'discovery_complete',
        label: 'Discovery complete',
        tags: [PLANNER_ANALYTICS_TAGS.discoveryComplete],
      },
      {
        id: 'sample_shown',
        label: 'Sample shown',
        tags: [PLANNER_ANALYTICS_TAGS.sampleShown],
      },
      {
        id: 'quote_requested',
        label: 'Help me build it',
        tags: [PLANNER_ANALYTICS_TAGS.quoteRequested],
      },
    ],
  },
];
