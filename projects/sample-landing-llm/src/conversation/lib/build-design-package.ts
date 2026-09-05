import type {
  DesignDraft,
  IntegrationInterest,
  PlannerUseCase,
} from '../planner-schema';

/**
 * Fail-closed design package — rich spoken sample (Nest planner doctrine).
 * Never dump funnel/CSAT jargon into the dialogue.
 */
export function buildDesignPackage(input: {
  companyName: string;
  companyDoes: string;
  useCase: PlannerUseCase;
  discoveryAnswers: string[];
  integrationInterest?: IntegrationInterest;
  correctionHint?: string;
}): DesignDraft {
  const company = (input.companyName || 'your company').trim();
  const does = (input.companyDoes || 'serves customers').trim();
  const answers = input.discoveryAnswers ?? [];
  const mustKnow =
    answers[0]?.trim() || 'name, callback number, and what they need';
  const transfer =
    answers[1]?.trim() ||
    'angry callers, out-of-scope requests, or when they ask for a person';
  const callers = answers[2]?.trim() || 'website visitors and inbound callers';

  const funnelId =
    input.useCase === 'book'
      ? 'booking'
      : input.useCase === 'faq'
        ? 'faq_containment'
        : input.useCase === 'dispatch'
          ? 'dispatch'
          : 'lead_intake';

  const funnelLabel =
    input.useCase === 'book'
      ? `${company} · appointments booked`
      : input.useCase === 'faq'
        ? `${company} · questions answered`
        : input.useCase === 'dispatch'
          ? `${company} · jobs dispatched`
          : `${company} · leads qualified`;

  const flowNodes =
    input.useCase === 'book'
      ? [
          { id: 'greet', label: 'Greet', kind: 'speak' },
          { id: 'need', label: 'Confirm booking intent', kind: 'listen' },
          { id: 'slot', label: 'Collect day / time', kind: 'listen' },
          { id: 'contact', label: 'Name + callback', kind: 'listen' },
          { id: 'confirm', label: 'Confirm appointment', kind: 'speak' },
          { id: 'done', label: 'Done', kind: 'end' },
        ]
      : input.useCase === 'faq'
        ? [
            { id: 'greet', label: 'Greet', kind: 'speak' },
            { id: 'question', label: 'Hear the question', kind: 'listen' },
            { id: 'answer', label: 'Answer from knowledge', kind: 'speak' },
            { id: 'more', label: 'Anything else?', kind: 'listen' },
            { id: 'done', label: 'Done', kind: 'end' },
          ]
        : input.useCase === 'dispatch'
          ? [
              { id: 'greet', label: 'Greet', kind: 'speak' },
              { id: 'urgency', label: 'Urgency + location', kind: 'listen' },
              { id: 'details', label: 'Job details', kind: 'listen' },
              { id: 'contact', label: 'Callback number', kind: 'listen' },
              { id: 'dispatch', label: 'Dispatch + ETA', kind: 'speak' },
              { id: 'done', label: 'Done', kind: 'end' },
            ]
          : [
              { id: 'greet', label: 'Greet', kind: 'speak' },
              { id: 'need', label: 'Capture need', kind: 'listen' },
              { id: 'qualify', label: 'Collect must-knows', kind: 'listen' },
              { id: 'route', label: 'Fit check / route', kind: 'route' },
              { id: 'handoff', label: 'Confirm handoff', kind: 'speak' },
              { id: 'done', label: 'Done', kind: 'end' },
            ];

  const sampleConversation = buildRichSample({
    company,
    does,
    useCase: input.useCase,
    mustKnow,
    transfer,
    callers,
    integrationInterest: input.integrationInterest,
    correctionHint: input.correctionHint,
  });

  return {
    funnels: [
      { id: funnelId, label: funnelLabel },
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

function buildRichSample(input: {
  company: string;
  does: string;
  useCase: PlannerUseCase;
  mustKnow: string;
  transfer: string;
  callers: string;
  integrationInterest?: IntegrationInterest;
  correctionHint?: string;
}): string {
  const brand = input.company;
  const hint = input.correctionHint || '';

  if (input.useCase === 'faq' || /faq|question|jargon|unnatural/i.test(hint)) {
    return lines([
      `Agent: Thanks for calling ${brand}. What's going wrong today?`,
      `Caller: I can't log in — and I need a copy of my last invoice.`,
      `Agent: Got it — login first. What's the email on the account?`,
      `Caller: sam@example.test`,
      `Agent: I found the account. I can reset the password now, then send the invoice. Want both?`,
      `Caller: Yes — both, please.`,
      `Agent: Password reset is on the way, and the invoice is emailed. Anything else?`,
      `Caller: No — that covers it.`,
      `Agent: If a refund or account change comes up later, I'll connect you to a person.`,
      `Caller: Understood. Thanks.`,
      `Agent: Glad I could help. Take care — goodbye.`,
    ]);
  }

  if (input.useCase === 'dispatch') {
    return lines([
      `Agent: Thanks for calling ${brand}. Are you calling about a service dispatch?`,
      `Caller: Yes — I need someone out today.`,
      `Agent: Got it. Where are you, and how urgent is this?`,
      `Caller: Downtown — ASAP if possible.`,
      `Agent: Understood. Briefly — ${shortAsk(input.mustKnow)}?`,
      `Caller: Sure — here's what the tech needs to know.`,
      `Agent: Best mobile number for the tech?`,
      `Caller: 555-0142.`,
      `Agent: I'll dispatch someone and text an ETA to that number. Anything else?`,
      `Caller: That's all.`,
      `Agent: Help is on the way. Take care — goodbye.`,
    ]);
  }

  if (input.useCase === 'book') {
    return lines([
      `Agent: Thanks for calling ${brand}. Are you looking to book an appointment?`,
      `Caller: Yes — sometime this week if you have openings.`,
      `Agent: Happy to help. What day works best?`,
      `Caller: Thursday afternoon.`,
      `Agent: I have Thursday at 2:30. Does that work?`,
      `Caller: Perfect.`,
      `Agent: Great. What's your name?`,
      `Caller: Jordan.`,
      `Agent: Thanks, Jordan. Best number to reach you?`,
      `Caller: 555-0199.`,
      `Agent: You're booked Thursday at 2:30. I'll text a confirmation. Anything else?`,
      `Caller: No thanks.`,
      `Agent: See you Thursday — goodbye.`,
    ]);
  }

  // qualify / other — spoken lead intake (never "I need help with qualify inbound leads")
  const needLine =
    input.useCase === 'qualify'
      ? "I'm interested — can someone follow up about your service?"
      : `I have a question about what ${brand} offers.`;

  return lines([
    `Agent: Thanks for calling ${brand}. How can I help you today?`,
    `Caller: ${needLine}`,
    `Agent: Happy to help. ${firstPersonDoes(input.does)}. What's your name?`,
    `Caller: Alex.`,
    `Agent: Thanks, Alex. Best number to reach you?`,
    `Caller: 555-0100.`,
    `Agent: And briefly — ${shortAsk(input.mustKnow)}?`,
    `Caller: Sure — here's what matters for my call.`,
    `Agent: Got it. Typical handoff to a person is when ${shortClause(input.transfer)}. Does that sound right?`,
    `Caller: Yes — continue.`,
    `Agent: Perfect. I'll note this for follow-up${
      input.integrationInterest === 'crm' ? ' and pass it to your CRM' : ''
    }. Anything else before we wrap?`,
    `Caller: That's all — thanks.`,
    `Agent: Thanks for calling ${brand}. Goodbye.`,
  ]);
}

function lines(rows: string[]): string {
  return rows.join('\n');
}

function shortAsk(raw: string): string {
  const s = raw.replace(/\?+$/, '').trim();
  if (!s) return 'what should I note for the team';
  // Avoid parroting long discovery dumps into the agent ask.
  const first = s.split(/[.;]/)[0]?.trim() || s;
  return first.length > 90 ? `${first.slice(0, 87)}…` : first;
}

function shortClause(raw: string): string {
  const s = raw.replace(/^when\s+/i, '').trim();
  const first = s.split(/[.;]/)[0]?.trim() || s;
  return first.length > 100 ? `${first.slice(0, 97)}…` : first;
}

function ensureVerb(does: string): string {
  const d = does.trim().replace(/\.$/, '');
  if (!d) return 'helps customers';
  if (/^we\s+/i.test(d)) {
    return d.replace(/^we\s+/i, '').trim();
  }
  return d;
}

function firstPersonDoes(does: string): string {
  const d = does.trim().replace(/\.$/, '');
  if (!d) return 'We help customers every day';
  if (/^(we|our|i)\b/i.test(d)) {
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  // Noun phrase ("Family dental office") — never "We family dental office".
  if (!hasActionVerb(d)) {
    if (/^(a|an|the)\b/i.test(d)) {
      return `We're ${leadLower(d)}`;
    }
    const article = /^[aeiouAEIOU]/.test(d) ? 'an' : 'a';
    return `We're ${article} ${leadLower(d)}`;
  }
  return `We ${leadLower(d)}`;
}

/** Lowercase lead char unless the token looks like an acronym (HVAC). */
function leadLower(s: string): string {
  if (/^[A-Z]{2,}/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function hasActionVerb(does: string): boolean {
  // "HVAC repair company" / "family dental office" — noun phrases, not actions.
  if (
    /\b(company|office|clinic|practice|agency|shop|store|firm|business|studio)\.?$/i.test(
      does.trim(),
    )
  ) {
    return false;
  }
  return /\b(sell|sold|install|repair|provide|offer|run|help|serve|build|make|do|manage|handle|operate|deliver|create|support|book|qualify|answer|dispatch|clean|fix|replace|design|develop|grow|own|work)\w*\b/i.test(
    does,
  );
}

export function formatSampleForSpeech(sample: string): string {
  return sample
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

/** Brief visitor-facing wrapper — no funnel lecture (Nest LP doctrine). */
export function sampleRevealMessage(
  sample: string,
  opts?: { scopeHint?: string },
): string {
  const parts = [
    "Here's a sample call based on what you shared.",
    '',
    sample,
    '',
  ];
  if (opts?.scopeHint) {
    parts.push(opts.scopeHint, '');
  }
  parts.push(
    'Tell me what to change, or say Help me build it if you want Guidify to take it from here. Is there anything else I can help with?',
  );
  return parts.join('\n');
}
