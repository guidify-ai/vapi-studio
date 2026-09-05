import type {
  DesignDraft,
  IntegrationInterest,
  PlannerUseCase,
} from '../planner-schema';

const USE_CASE_LABEL: Record<PlannerUseCase, string> = {
  qualify: 'qualify inbound leads',
  book: 'book appointments',
  faq: 'answer FAQs',
  dispatch: 'dispatch / triage',
  other: 'handle inbound calls',
};

/**
 * Fail-closed design package from discovery memory.
 * Brain may refine later; this always produces a showable sample.
 */
export function buildDesignPackage(input: {
  companyName: string;
  companyDoes: string;
  useCase: PlannerUseCase;
  discoveryAnswers: string[];
  integrationInterest?: IntegrationInterest;
}): DesignDraft {
  const company = (input.companyName || 'your company').trim();
  const does = (input.companyDoes || 'serves customers').trim();
  const use = USE_CASE_LABEL[input.useCase] || USE_CASE_LABEL.other;
  const mustKnow =
    input.discoveryAnswers[0]?.trim() ||
    'name, callback number, and what they need';
  const transfer =
    input.discoveryAnswers[1]?.trim() ||
    'angry callers, out-of-scope jobs, or when they ask for a person';
  const callers =
    input.discoveryAnswers[2]?.trim() || 'website visitors and inbound callers';
  const integration =
    input.integrationInterest === 'crm'
      ? 'CRM handoff after a successful path'
      : input.integrationInterest === 'tools'
        ? 'tool / calendar integrations where needed'
        : 'no CRM required for the first module';

  const funnelId =
    input.useCase === 'book'
      ? 'booking'
      : input.useCase === 'faq'
        ? 'faq_containment'
        : 'lead_intake';

  const flowNodes = [
    { id: 'greet', label: 'Greet', kind: 'speak' },
    { id: 'need', label: 'Capture need', kind: 'listen' },
    { id: 'qualify', label: 'Collect must-knows', kind: 'listen' },
    { id: 'route', label: 'Route / decision', kind: 'route' },
    { id: 'success', label: 'Success path', kind: 'speak' },
    { id: 'done', label: 'Done', kind: 'end' },
  ];

  const sampleConversation = [
    `Agent: Thanks for calling ${company}. How can I help you today?`,
    `Caller: Hi — I need help with ${use.replace(/^./, (c) => c)}.`,
    `Agent: Got it. ${company} ${does}. I'll keep this short.`,
    `Agent: First — what's your name?`,
    `Caller: Alex.`,
    `Agent: Thanks, Alex. What's the best number to reach you?`,
    `Caller: 555-0100.`,
    `Agent: And briefly — ${mustKnow.split(/[.?]/)[0] || mustKnow}?`,
    `Caller: Sure — here's what matters for my call.`,
    `Agent: Perfect. I'll note that and keep you on the right path.`,
    `Agent: One more check — if this isn't a fit, or you want a person, say so and I'll transfer. Typical transfer cases: ${transfer}.`,
    `Caller: This looks right — continue.`,
    `Agent: Great. Next I'll ${
      input.useCase === 'book'
        ? 'offer the next open appointment window'
        : input.useCase === 'faq'
          ? 'answer from your knowledge base'
          : 'finish qualification and confirm the handoff'
    }.`,
    `Caller: Sounds good.`,
    `Agent: You're set. ${integration}. Anything else before we wrap?`,
    `Caller: That's all — thanks.`,
    `Agent: Thanks for calling ${company}. Goodbye.`,
  ].join('\n');

  return {
    funnels: [
      { id: funnelId, label: `${company} · ${use}` },
      { id: 'containment', label: 'Contained without transfer' },
    ],
    analyticsEvents: [
      'call_started',
      'need_captured',
      'must_knows_collected',
      'path_completed',
      'transferred',
      'ended',
    ],
    flowNodes,
    portals: [
      'unknownTransition',
      'mad',
      'stillThere',
      'goodbye',
      'transferToHuman',
    ],
    sampleConversation,
  };
}

export function formatSampleForSpeech(sample: string): string {
  const lines = sample
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.join('\n');
}
