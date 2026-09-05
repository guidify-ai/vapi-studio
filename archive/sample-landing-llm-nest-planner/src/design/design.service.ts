import { Injectable } from '@nestjs/common';
import { DESIGN_MASTER_SYSTEM } from './master-prompt';
import {
  knowledgeBasePromptBlock,
  looksLikeKnowledgeQuestion,
  matchKnowledge,
} from './knowledge-base';
import {
  ChatMessage,
  DesignDraftPublic,
  LeadsService,
  PrivateQuote,
} from '../leads/leads.service';

type AgentJson = {
  assistantMessage?: string;
  draft?: DesignDraftPublic;
  private?: PrivateQuote;
};

const DEFAULT_FLOW = [
  { id: 'greeting', label: 'Greeting', kind: 'speak' },
  { id: 'listen_need', label: 'Listen need', kind: 'listen' },
  { id: 'route', label: 'Route', kind: 'portal' },
  { id: 'end', label: 'End', kind: 'end' },
];

const DEFAULT_PORTALS = [
  'unknownTransition',
  'mad',
  'stillThere',
  'goodbye',
  'transferToHuman',
];

const FALLBACK_OPENING: AgentJson = {
  assistantMessage:
    "Hi — I'm the Vapi Studio planner. What's your company name?",
  draft: emptyDraft(),
  private: {
    complexity: 'S',
    quoteHours: 24,
    baseHours: 24,
    integrationHours: 0,
    integrationKind: 'none',
    rationale: 'Opening only',
  },
};

const MAX_DISCOVERY_QUESTIONS = 7;
const MAX_CORRECTIONS = 10;

const DISCOVERY_QUESTIONS = [
  'What specific facts should the agent get from the caller before it finishes?',
  'When should it transfer to a human — or who is not a fit?',
  'Who typically calls — and what do they usually ask first?',
  'Any tone or brand rules the agent must respect?',
  'Anything else critical before I draft the flow?',
  'When is someone not a fit, and what should the agent do then?',
  'What else should I know before I show a sample call?',
];

type InterviewStep = {
  id: number;
  label: string;
  instruction: string;
};

/** Map draft completeness → next required topic from the fixed interview. */
function nextInterviewStep(draft: DesignDraftPublic): InterviewStep {
  if (
    !(draft.companyName || '').trim() ||
    !(draft.contactEmail || '').trim() ||
    !(draft.contactName || '').trim()
  ) {
    return {
      id: 1,
      label: 'Contact form',
      instruction:
        'Contact must come from the obligatory form (company, email, name) — do not ask these in chat.',
    };
  }
  if (!(draft.companyDoes || '').trim()) {
    return {
      id: 4,
      label: 'What the company does',
      instruction: 'Ask for one plain sentence about what their company does.',
    };
  }
  if (!(draft.useCase || '').trim()) {
    return {
      id: 5,
      label: 'Top-of-mind Vapi Studio use case',
      instruction:
        'Ask what they want to try first (lead collection, FAQ, booking, qualify, transfer, etc.).',
    };
  }

  const discoveryAnswers = draft.discoveryAnswers || [];
  if (!draft.discoveryComplete && discoveryAnswers.length < MAX_DISCOVERY_QUESTIONS) {
    const n = discoveryAnswers.length + 1;
    const skipSuccessAsk =
      n === 1 &&
      /\b(qualif|book|faq|lead|appoint|intake|screen|dispatch|donat|reserv)/i.test(
        draft.useCase || '',
      );
    return {
      id: 51,
      label: 'Discovery',
      instruction: [
        `Ask discovery question ${n} of up to ${MAX_DISCOVERY_QUESTIONS} about what matters for THEIR callers and outcomes.`,
        skipSuccessAsk
          ? 'Do NOT ask “what counts as a successful call” — the use case already implies it. Ask must-know caller facts or transfer/disqualify rules instead.'
          : 'Prioritize: must-know facts, not-a-fit / transfer rules, urgency, tone. Skip success-criteria if use case already states the outcome.',
        'One question only — exactly one question mark in assistantMessage. Do not restate and ask in the same message.',
        'Never burn questions on identity you already have from the form.',
        'Append their latest reply into draft.discoveryAnswers (never append off-topic replies).',
        'If you already have enough to design a strong agent (often after 2–4 solid answers), set discoveryComplete=true and say you will draft next.',
        'If guest says proceed / ready / build / enough — set discoveryComplete=true immediately.',
        `At ${MAX_DISCOVERY_QUESTIONS} answers you MUST set discoveryComplete=true.`,
      ].join(' '),
    };
  }

  if ((draft.sampleConversation || []).length > 0) {
    const used = Number(draft.correctionCount) || 0;
    return {
      id: 90,
      label: 'Corrections / close',
      instruction: [
        `Internal: plan corrections used ${used}/${MAX_CORRECTIONS} (never tell the guest this number).`,
        used >= MAX_CORRECTIONS
          ? 'Correction cap reached — do not redesign. Say we will figure out the rest while preparing their quote, and point to Help me build it. Never mention caps or limits.'
          : 'If they request a change, apply it to flow/funnels/events/sample, increment correctionCount, re-show [[SAMPLE_CALL]] when useful. Invite tweaks without naming any numeric limit.',
        'Soft affirmatives (ok / looks good / thanks) → offerHelp=true, Help me build it, then always ask if anything else you can help with.',
        'If they ask Guidify to build / Help me build it → offerHelp=true and point to the button; do not restart design; still ask if anything else you can help with.',
        'Product questions: answer from the knowledge base. If unknown: say the Vapi Studio team will contact them to resolve it, log it privately, ask if anything else you can help with.',
      ].join(' '),
    };
  }

  // One CRM ask, then a single design+sample beat (no funnel→analytics→flow treadmill).
  if (!(draft.integrationInterest || '').trim()) {
    return {
      id: 10,
      label: 'CRM / integrations',
      instruction:
        'Ask ONE short question about CRM or tools to integrate. Do not propose funnel/analytics/flow yet. Note privately whether common vs custom; never speak hours.',
    };
  }
  return {
    id: 12,
    label: 'Design package + sample',
    instruction: [
      'THIS TURN: fill draft.funnels (1 useful funnel), draft.analyticsEvents (tied to that funnel), draft.flowNodes (finite + portals), and draft.sampleConversation (10–16 spoken lines).',
      'Visitor-facing assistantMessage: brief one-sentence setup + [[SAMPLE_CALL]] + invite tweaks or Help me build it.',
      'Do NOT dump funnel/analytics/flow as a lecture in assistantMessage — those live in the draft/preview pane.',
      'Sample: human-like phone dialogue; clarify → help → outcome; never CSAT/analytics/discovery jargon in spoken lines.',
      'Set offerHelp=true. Set draft.desiredResult from their use case + discovery.',
      'If they asked Guidify to build / hire you: say Guidify can take it from here and point to Help me build it.',
    ].join(' '),
  };
}

function contactComplete(draft: DesignDraftPublic): boolean {
  return Boolean(
    (draft.companyName || '').trim() &&
      (draft.contactEmail || '').trim() &&
      (draft.contactName || '').trim(),
  );
}

function isSoftAffirmative(text: string): boolean {
  return /^(ok|okay|looks good|sounds good|great|thanks|thank you|yes|yep|ship it|done|perfect|good|fine|bien)\.?$/i.test(
    text.trim(),
  );
}

function declinesMoreHelp(text: string): boolean {
  const t = text.trim();
  if (
    /^(no|nope|no thanks|nothing|nothing else|i'?m good|im good|all good|that'?s (all|it)|no more|better\.?\s*nothing else)\.?$/i.test(
      t,
    )
  ) {
    return true;
  }
  return (
    /\b(nothing else|no more( help| questions)?|i'?m (all )?done for now|that'?s all for now)\b/i.test(
      t,
    ) && !/\b(but|except)\b/i.test(t)
  );
}

function integrationUnset(value: string | undefined): boolean {
  const t = (value || '').trim().toLowerCase();
  return !t || t === 'none yet' || t === 'unknown' || t === 'tbd';
}

/** Hire / meta language must not become the product use case. */
function sanitizeUseCase(text: string): string {
  const t = (text || '').trim();
  if (!t) return '';
  if (
    /\b(want guidify to build|help me build|hire (guidify|you)|have guidify build)\b/i.test(
      t,
    )
  ) {
    if (/\bfaq\b/i.test(t)) return 'Answer inbound support FAQs by phone';
    if (/\broadside|fleet|van/i.test(t)) {
      return 'Book roadside repair visits for fleet vehicles';
    }
    if (/\bbook|appoint|repair/i.test(t)) {
      return 'Book appointments from inbound calls';
    }
    if (/\bdispatch|eta|tracking/i.test(t)) {
      return 'Inbound dispatch: confirm pickup window and driver ETA';
    }
    return 'Qualify inbound leads and route strong ones to a human';
  }
  // Strip impatient / process fluff from use-case answers.
  if (/\b(stop fluff|build something|proceed|enough)\b/i.test(t)) {
    if (/\bqualif/i.test(t)) return 'Qualify inbound leads';
    if (/\bbook/i.test(t)) return 'Book appointments from inbound calls';
    if (/\bfaq/i.test(t)) return 'Answer common support FAQs by phone';
  }
  return t.slice(0, 500);
}

const OPEN_HELP_QUESTION = 'Is there anything else I can help with?';

/** At most one `?` so discovery / sample turns never stack questions. */
function enforceSingleQuestionMark(text: string): string {
  const t = (text || '').trim();
  if (!t) return t;
  const marks = (t.match(/\?/g) || []).length;
  if (marks <= 1) return t;
  const first = t.indexOf('?');
  const head = t.slice(0, first + 1);
  const tail = t
    .slice(first + 1)
    .replace(/\?/g, '.')
    .replace(/\.\s*\./g, '.')
    .trim();
  return `${head}${tail ? ` ${tail}` : ''}`.trim();
}

function withOpenQuestion(text: string): string {
  let t = (text || '').trim();
  if (!t) return OPEN_HELP_QUESTION;
  if (/anything else I can help|anything else I can (do|assist)|what else can I help/i.test(t)) {
    return enforceSingleQuestionMark(t);
  }
  // Body must not also ask — open-help is the only question mark.
  if ((t.match(/\?/g) || []).length >= 1) {
    t = t.replace(/\?/g, '.').replace(/\.\s*\./g, '.').trim();
  }
  return `${t}\n\n${OPEN_HELP_QUESTION}`;
}

function appendUnanswered(
  prior: PrivateQuote | null | undefined,
  question: string,
): PrivateQuote {
  const base = sanitizePrivate(prior || basePrivate('M', 48, 'Unanswered question'));
  const list = [
    ...new Set(
      [...(base.unansweredQuestions || []), question.trim()]
        .map((q) => q.slice(0, 500))
        .filter(Boolean),
    ),
  ].slice(0, 40);
  return {
    ...base,
    unansweredQuestions: list,
    hotLead: true,
    hotLeadReason:
      base.hotLeadReason ||
      `Unanswered guest question logged for follow-up: ${question.slice(0, 120)}`,
  };
}

function wantsAccelerate(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isSoftAffirmative(t)) return true;
  return /\b(proceed|go ahead|ready|enough|skip|draft it|build (it|something)|show (me )?(a )?sample|that'?s all|thats all|nothing else|no more)\b/i.test(
    t,
  );
}

function wantsHireHelp(text: string): boolean {
  return /\b(help me build|hire (guidify|you|the team)|want guidify to build|official team|have guidify)\b/i.test(
    text,
  );
}

/** Guest wants to end the planner conversation entirely. */
export function wantsGuestExit(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /^(bye|goodbye|good bye|exit|quit|stop|cancel|end chat|end conversation)[.!]?$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /\b(i('?m| am) done|that'?s all for now|end (the )?(chat|conversation|session)|i (want to|gotta|have to) (leave|go|exit|stop)|stop (chatting|talking)|leave (me|this) alone)\b/i.test(
    t,
  );
}

/**
 * Guest wants a human on THIS planner chat (not “when should the agent transfer”).
 * On the marketing site there is no live handoff — we wrap up and email Guidify.
 */
export function wantsTransferToHuman(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Design answers about when the *voice agent* should transfer (not this chat).
  if (
    /\b(if they|when they|callers? (who|that|usually)|should (it|the (voice )?agent) transfer|transfer (on|if|when|for)|agent (should|will|can) transfer|gas smell|unsafe|not a fit|disqualif|refund|account deletion|complex issues)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  if (
    /^(transfer|human please|talk to (someone|a human|a person)|speak to (someone|a human)|connect me)[.!]?$/i.test(
      t,
    )
  ) {
    return true;
  }
  // First-person ask for a human on *this* planner session.
  return /\b(i (want|need) (a |to (talk|speak) to (a )?)?(human|person|someone)|connect me (to|with) (a )?(human|person|agent|guidify)|(talk|speak) to (a )?(human|person|someone|representative) (please|now|here)?|transfer me (to|with)|live (agent|person|support)|real person)\b/i.test(
    t,
  );
}

function looksOffTopic(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /\b(qualif|book|lead|faq|appoint|transfer|caller|crm|hubspot|salesforce|integrat|proceed|sample|dispatch|eta|sick|vaccine|freight|plumb)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  return /^(what('?s| is) the weather|tell me a joke|who are you|what time is it)\b/i.test(
    t,
  );
}

function looksLikeIntegrationReply(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 120) return false;
  if (
    /^(none|n\/?a|no(pe)?|not yet|no crm|just email|email only|byok)\.?$/i.test(t)
  ) {
    return true;
  }
  return /^(hubspot|salesforce|zendesk|intercom|jobber|jobnimbus|clio|toast|mcleod|follow up boss|daysmart|cloudbeds|appfolio|custom( internal)?( api)?)\b/i.test(
    t,
  );
}

function isRealCorrection(text: string): boolean {
  if (!text.trim()) return false;
  if (isSoftAffirmative(text) || wantsAccelerate(text)) return false;
  if (declinesMoreHelp(text)) return false;
  if (looksLikeIntegrationReply(text)) return false;
  if (wantsHireHelp(text)) return false;
  if (looksLikeKnowledgeQuestion(text)) return false;
  return true;
}

function applyRebrand(draft: DesignDraftPublic, userText: string): void {
  const m =
    userText.match(
      /\b(?:we (?:are|rebranded to)|now called|company is)\s+([A-Z][\w &.'-]{1,60})/i,
    ) ||
    userText.match(/\brebranded[ —\-–:]+(?:we are )?([A-Z][\w &.'-]{1,60})/i);
  if (!m?.[1]) return;
  const name = m[1].replace(/[.,;:]+$/, '').trim().slice(0, 200);
  if (name.length < 2) return;
  // Don't treat CRM product names as company renames.
  if (looksLikeIntegrationReply(name)) return;
  draft.companyName = name;
  draft.product = name;
  // Business description after the new name (comma / dash).
  const after = userText.split(name)[1] || '';
  const does = after.replace(/^[,\s—\-–:]+/, '').trim().replace(/\.$/, '');
  if (does && does.length > 2) {
    draft.companyDoes = does.slice(0, 500);
    draft.vertical = draft.companyDoes;
  }
}

function ensureDesignPackage(draft: DesignDraftPublic): DesignDraftPublic {
  const out: DesignDraftPublic = {
    ...emptyDraft(),
    ...draft,
    portals: draft.portals?.length ? draft.portals : [...DEFAULT_PORTALS],
    discoveryAnswers: [...(draft.discoveryAnswers || [])],
  };
  out.desiredResult =
    (out.desiredResult || '').trim() ||
    [out.useCase, ...(out.discoveryAnswers || []).slice(0, 2)]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 500);
  const useCase = out.useCase || '';
  const funnelId = 'primary';
  const funnelLabel =
    /faq|question|inform/i.test(useCase)
      ? 'FAQ resolution'
      : /book|appoint/i.test(useCase)
        ? 'Booking'
        : /qualif/i.test(useCase)
          ? 'Lead qualification'
          : /dispatch|eta|package/i.test(useCase)
            ? 'Dispatch inquiry'
            : 'Lead intake';
  if (!(out.funnels || []).length) {
    out.funnels = [
      {
        id: funnelId,
        label: funnelLabel,
        steps: ['Start', 'Need', 'Qualify', 'Decision', 'Complete'],
      },
    ];
  }
  if (!(out.analyticsEvents || []).length) {
    out.analyticsEvents = [
      {
        tag: 'conversation_started',
        funnelId,
        step: 'Start',
        why: 'Entry volume for this funnel.',
      },
      {
        tag: 'need_identified',
        funnelId,
        step: 'Need',
        why: 'Separates curiosity from real intent.',
      },
      {
        tag: 'qualified',
        funnelId,
        step: 'Qualify',
        why: 'Shows how often callers meet your criteria.',
      },
      {
        tag: 'funnel_completed',
        funnelId,
        step: 'Complete',
        why: `North-star for “${funnelLabel}” success.`,
      },
    ];
  }
  const nodes = out.flowNodes || [];
  const flowThin =
    !nodes.length ||
    (nodes.length <= 4 &&
      nodes.every((n) =>
        ['greeting', 'listen_need', 'route', 'end'].includes(n.id),
      ));
  if (flowThin) {
    out.flowNodes = simpleFlowFor(useCase);
  }
  out.portals = [...DEFAULT_PORTALS];
  // Leave CRM blank until the guest answers — do not placeholder "none yet"
  // (that blocked post-sample HubSpot/Zendesk capture).
  if (
    !(out.sampleConversation || []).length ||
    isThinSample(out.sampleConversation) ||
    isAwkwardSample(out.sampleConversation)
  ) {
    out.sampleConversation = buildRichSample(out);
  }
  out.discoveryComplete = true;
  out.offerHelp = true;
  return out;
}

function mergeSeededContact(
  draft: DesignDraftPublic,
  seeded: DesignDraftPublic,
): DesignDraftPublic {
  return {
    ...draft,
    companyName: draft.companyName || seeded.companyName,
    contactEmail: draft.contactEmail || seeded.contactEmail,
    contactName: draft.contactName || seeded.contactName,
    companyDoes: draft.companyDoes || seeded.companyDoes,
    useCase: draft.useCase || seeded.useCase,
    product: draft.product || seeded.product || draft.companyName || seeded.companyName,
    vertical: draft.vertical || seeded.vertical || draft.companyDoes || seeded.companyDoes,
    desiredResult: draft.desiredResult || seeded.desiredResult || draft.useCase || seeded.useCase,
    discoveryAnswers:
      (draft.discoveryAnswers && draft.discoveryAnswers.length
        ? draft.discoveryAnswers
        : seeded.discoveryAnswers) || [],
    discoveryComplete: Boolean(draft.discoveryComplete || seeded.discoveryComplete),
    correctionCount: Math.max(
      Number(draft.correctionCount) || 0,
      Number(seeded.correctionCount) || 0,
    ),
    declinedMoreHelp: Boolean(draft.declinedMoreHelp || seeded.declinedMoreHelp),
    spokenBrand: draft.spokenBrand || seeded.spokenBrand || '',
    sampleCallerHook: draft.sampleCallerHook || seeded.sampleCallerHook || '',
    integrationInterest: integrationUnset(draft.integrationInterest)
      ? seeded.integrationInterest || ''
      : draft.integrationInterest,
  };
}

@Injectable()
export class DesignService {
  constructor(private readonly leads: LeadsService) {}

  /** Obligatory contact — no LLM. Company + email + name together. */
  async intake(input: {
    sessionId: string;
    clientIp: string;
    companyName: string;
    contactEmail: string;
    contactName: string;
  }): Promise<{
    assistantMessage: string;
    draft: DesignDraftPublic;
    messages: ChatMessage[];
    completed?: boolean;
    completedReason?: string;
  }> {
    await this.leads.assertConversationAllowed(
      input.sessionId,
      input.clientIp,
    );

    const existing = await this.leads.completeIfIdle(input.sessionId);
    if (this.leads.isTerminal(existing)) {
      const draft = sanitizeDraft(
        (existing?.designDraft as DesignDraftPublic) || emptyDraft(),
      );
      return {
        assistantMessage:
          'This conversation is already closed. Refresh the page to start a new planner session.',
        draft,
        messages: (existing?.messages as ChatMessage[]) || [],
        completed: true,
        completedReason: existing?.completedReason || existing?.status || 'completed',
      };
    }

    const companyName = String(input.companyName || '').trim().slice(0, 200);
    const contactEmail = String(input.contactEmail || '').trim().slice(0, 320);
    const contactName = String(input.contactName || '').trim().slice(0, 200);
    if (!companyName || !contactEmail || !contactName) {
      throw new Error('companyName, contactEmail, and contactName are required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw new Error('valid contactEmail is required');
    }

    const draft = emptyDraft();
    draft.companyName = companyName;
    draft.product = companyName;
    draft.contactEmail = contactEmail;
    draft.contactName = contactName;

    const assistantMessage = `Thanks. In one plain sentence, what does ${companyName} do?`;
    const messages: ChatMessage[] = [
      { role: 'assistant', content: assistantMessage },
    ];

    await this.leads.upsertDesignSession({
      sessionId: input.sessionId,
      clientIp: input.clientIp,
      messages,
      designDraft: draft,
      privateQuote: basePrivate('S', 24, 'Contact form completed'),
    });

    return { assistantMessage, draft, messages };
  }

  async complete(input: {
    sessionId: string;
    reason: 'left_site' | 'idle_timeout' | 'guest_exit' | 'transfer_human';
  }): Promise<{
    ok: boolean;
    completed: boolean;
    status: string;
    completedReason?: string | null;
  }> {
    const lead = await this.leads.completeSession({
      sessionId: input.sessionId,
      reason: input.reason,
    });
    if (!lead) {
      return { ok: true, completed: false, status: 'missing' };
    }
    return {
      ok: true,
      completed: this.leads.isTerminal(lead),
      status: lead.status,
      completedReason: lead.completedReason,
    };
  }

  async turn(input: {
    sessionId: string;
    clientIp: string;
    messages: ChatMessage[];
    userMessage?: string;
    clientDraft?: DesignDraftPublic | null;
  }): Promise<{
    assistantMessage: string;
    draft: DesignDraftPublic;
    messages: ChatMessage[];
    completed?: boolean;
    completedReason?: string;
  }> {
    await this.leads.assertConversationAllowed(
      input.sessionId,
      input.clientIp,
    );

    const idleOrOpen = await this.leads.completeIfIdle(input.sessionId);
    if (this.leads.isTerminal(idleOrOpen)) {
      const draft = sanitizeDraft(
        (idleOrOpen?.designDraft as DesignDraftPublic) ||
          sanitizeDraft(input.clientDraft || emptyDraft()),
      );
      const assistantMessage =
        idleOrOpen?.completedReason === 'idle_timeout'
          ? 'This session timed out after 30 minutes of inactivity. Refresh to start a new conversation.'
          : 'This conversation is already closed. Refresh the page to start a new planner session.';
      return {
        assistantMessage,
        draft,
        messages: (idleOrOpen?.messages as ChatMessage[]) || input.messages || [],
        completed: true,
        completedReason:
          idleOrOpen?.completedReason || idleOrOpen?.status || 'completed',
      };
    }

    const prior = (input.messages || []).filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    );
    const messages: ChatMessage[] = [...prior];
    if (input.userMessage?.trim()) {
      messages.push({ role: 'user', content: input.userMessage.trim() });
    }

    const stored = await this.leads.getDesignDraft(input.sessionId);
    const seeded = mergeSeededContact(
      sanitizeDraft(stored || emptyDraft()),
      sanitizeDraft(input.clientDraft || emptyDraft()),
    );

    if (!contactComplete(seeded)) {
      const assistantMessage =
        'Please complete the contact form (company, email, and name) to continue.';
      messages.push({ role: 'assistant', content: assistantMessage });
      return { assistantMessage, draft: seeded, messages };
    }

    const userText = input.userMessage?.trim() || '';

    // Guest explicitly ends the conversation.
    if (userText && wantsGuestExit(userText)) {
      const assistantMessage =
        'Understood — we’ll close this session here. Refresh anytime to start a new planner chat, or use Help me build it if you still want Guidify’s help.';
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: seeded,
        privateQuote: basePrivate('M', 40, 'Guest exit'),
      });
      await this.leads.completeSession({
        sessionId: input.sessionId,
        reason: 'guest_exit',
      });
      return {
        assistantMessage,
        draft: seeded,
        messages,
        completed: true,
        completedReason: 'guest_exit',
      };
    }

    // Transfer to human on this site = wrap up + email Guidify (no live handoff).
    if (userText && wantsTransferToHuman(userText)) {
      const assistantMessage =
        'Understood — I’ll wrap this up and have the Guidify team follow up with you. Thanks for chatting; refresh anytime to start a new planner session.';
      messages.push({ role: 'assistant', content: assistantMessage });
      const privateQuote = basePrivate(
        'M',
        44,
        `Transfer to human — ${userText.slice(0, 120)}`,
      );
      privateQuote.hotLead = true;
      privateQuote.hotLeadReason = `Guest requested transfer to human: ${userText.slice(0, 160)}`;
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: { ...seeded, offerHelp: true },
        privateQuote,
      });
      await this.leads.completeSession({
        sessionId: input.sessionId,
        reason: 'transfer_human',
      });
      void this.leads.notifyTransferHuman({
        sessionId: input.sessionId,
        draft: seeded,
        privateQuote,
        messages,
        triggerText: userText,
      });
      return {
        assistantMessage,
        draft: sanitizeDraft({ ...seeded, offerHelp: true }),
        messages,
        completed: true,
        completedReason: 'transfer_human',
      };
    }

    applyRebrand(seeded, userText);
    let step = nextInterviewStep(seeded);

    // Off-topic before/during discovery — do not treat as an answer.
    if (
      userText &&
      looksOffTopic(userText) &&
      (step.id === 4 || step.id === 5 || step.id === 51)
    ) {
      const assistantMessage =
        step.id === 4
          ? `Still need one plain sentence on what ${seeded.companyName || 'the company'} does.`
          : step.id === 5
            ? 'I stay on designing your voice agent — what should this bot do for callers (qualify, book, FAQ, etc.)?'
            : 'I stay on designing your voice agent — what must the bot learn from callers, or when should it transfer?';
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: seeded,
        privateQuote: basePrivate('M', 36, 'Off-topic redirected'),
      });
      return { assistantMessage, draft: seeded, messages };
    }

    // Hire Guidify with almost no discovery — ask one must-know first (better lead).
    if (
      userText &&
      wantsHireHelp(userText) &&
      seeded.useCase?.trim() &&
      !(seeded.sampleConversation || []).length &&
      (seeded.discoveryAnswers || []).length < 1 &&
      !wantsAccelerate(userText.replace(/help me build.*/i, '').trim())
    ) {
      const assistantMessage =
        'Glad to help build it. What facts must the agent capture from callers before a handoff?';
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: { ...seeded, offerHelp: true },
        privateQuote: basePrivate('M', 44, 'Hire intent — one discovery ask'),
      });
      return {
        assistantMessage,
        draft: sanitizeDraft({ ...seeded, offerHelp: true }),
        messages,
      };
    }

    // Guest wants to move on / hire — finish discovery and jump to sample (no checklist treadmill).
    const accelerate =
      Boolean(userText) &&
      (wantsAccelerate(userText) ||
        (wantsHireHelp(userText) &&
          (seeded.discoveryAnswers || []).length >= 1));
    const sampleAlreadySpoken = messages.some(
      (m) =>
        m.role === 'assistant' && /\[\[SAMPLE_CALL\]\]/i.test(m.content || ''),
    );
    if (
      accelerate &&
      seeded.useCase?.trim() &&
      (!(seeded.sampleConversation || []).length || !sampleAlreadySpoken)
    ) {
      if (!seeded.discoveryComplete) {
        seeded.discoveryComplete = true;
      }
      if (wantsHireHelp(userText)) {
        seeded.offerHelp = true;
      }
      // Prefer model sample; fall back to packaged draft.
      step = {
        id: 12,
        label: 'Design package + sample',
        instruction: [
          'Guest asked to move on or hire Guidify.',
          'Fill funnels, analyticsEvents, flowNodes, and sampleConversation NOW.',
          'assistantMessage: one short sentence + [[SAMPLE_CALL]] + Help me build it invite.',
          'Do not lecture funnel/analytics/flow in chat. No CSAT jargon in spoken sample lines.',
          wantsHireHelp(userText)
            ? 'Acknowledge Guidify can build this and point to Help me build it.'
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      };
    }

    // CRM named during discovery → capture as integration and package (don't append as an answer).
    if (
      step.id === 51 &&
      userText &&
      looksLikeIntegrationReply(userText) &&
      seeded.useCase?.trim() &&
      (seeded.discoveryAnswers || []).length >= 1
    ) {
      const packed = ensureDesignPackage(
        sanitizeDraft({
          ...seeded,
          integrationInterest: userText.slice(0, 400),
          discoveryComplete: true,
          offerHelp: true,
          sampleConversation: [],
        }),
      );
      const assistantMessage = withOpenQuestion(
        `Here’s a sample call based on what you shared.\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`,
      );
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: packed,
        privateQuote: basePrivate(
          'M',
          48,
          `CRM during discovery + sample: ${userText.slice(0, 80)}`,
        ),
      });
      return { assistantMessage, draft: packed, messages };
    }

    // CRM answer during integrations step → package + sample immediately.
    if (
      step.id === 10 &&
      userText &&
      looksLikeIntegrationReply(userText) &&
      seeded.useCase?.trim()
    ) {
      const packed = ensureDesignPackage(
        sanitizeDraft({
          ...seeded,
          integrationInterest: userText.slice(0, 400),
          discoveryComplete: true,
          offerHelp: true,
        }),
      );
      const assistantMessage = withOpenQuestion(
        `Here’s a sample call based on what you shared.\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`,
      );
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: packed,
        privateQuote: basePrivate(
          'M',
          48,
          `CRM noted + sample: ${userText.slice(0, 80)}`,
        ),
      });
      return { assistantMessage, draft: packed, messages };
    }

    // After sample: CRM/tool replies are lead data — not plan corrections.
    if (
      step.id === 90 &&
      userText &&
      looksLikeIntegrationReply(userText) &&
      integrationUnset(seeded.integrationInterest)
    ) {
      const draft = sanitizeDraft({
        ...seeded,
        integrationInterest: userText.slice(0, 400),
        offerHelp: true,
      });
      const assistantMessage =
        seeded.declinedMoreHelp
          ? 'Noted for integrations. Use Help me build it below anytime.'
          : withOpenQuestion(
              'Noted for integrations. Tell me what to change in the sample, or use Help me build it below.',
            );
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: draft,
        privateQuote: basePrivate('M', 48, `Integration noted: ${userText.slice(0, 80)}`),
      });
      return { assistantMessage, draft, messages };
    }

    // Knowledge / unknown questions after (or during) design — never leave them hanging.
    if (
      userText &&
      looksLikeKnowledgeQuestion(userText) &&
      (step.id === 90 || step.id === 12 || step.id === 10 || step.id === 51)
    ) {
      const hit = matchKnowledge(userText);
      const draft = sanitizeDraft({ ...seeded, offerHelp: true });
      if (hit) {
        const assistantMessage = seeded.declinedMoreHelp
          ? hit.answer
          : withOpenQuestion(hit.answer);
        messages.push({ role: 'assistant', content: assistantMessage });
        await this.leads.upsertDesignSession({
          sessionId: input.sessionId,
          clientIp: input.clientIp,
          messages,
          designDraft: draft,
          privateQuote: basePrivate('M', 44, `KB answer: ${hit.id}`),
        });
        return { assistantMessage, draft, messages };
      }
      const priorLead = await this.leads.getLead(input.sessionId);
      const privateQuote = appendUnanswered(
        (priorLead?.privateQuote as PrivateQuote) || null,
        userText,
      );
      draft.unansweredQuestions = [...(privateQuote.unansweredQuestions || [])];
      const assistantMessage = seeded.declinedMoreHelp
        ? "I don’t have a definitive answer on that in the planner. The Vapi Studio team (Guidify) will contact you to resolve this question — use Help me build it below so it’s attached to your draft."
        : withOpenQuestion(
            "I don’t have a definitive answer on that in the planner. The Vapi Studio team (Guidify) will contact you to resolve this question — use Help me build it below so it’s attached to your draft.",
          );
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: draft,
        privateQuote,
      });
      return { assistantMessage, draft, messages };
    }

    // Soft close after sample — not a correction. Always leave an open help question
    // unless they already declined more help.
    // Never soft-close without a spoken [[SAMPLE_CALL]] (fixes FAQ empty-sample exits).
    const sawSample = messages.some(
      (m) =>
        m.role === 'assistant' && /\[\[SAMPLE_CALL\]\]/i.test(m.content || ''),
    );
    if (
      step.id === 90 &&
      userText &&
      sawSample &&
      (isSoftAffirmative(userText) ||
        declinesMoreHelp(userText) ||
        wantsHireHelp(userText) ||
        wantsAccelerate(userText))
    ) {
      const declined = declinesMoreHelp(userText) || Boolean(seeded.declinedMoreHelp);
      const draft = sanitizeDraft({
        ...seeded,
        offerHelp: true,
        declinedMoreHelp: declined,
        refinementOffer:
          seeded.refinementOffer ||
          'Guidify can build this with you — use Help me build it below.',
      });
      const assistantMessage = declined
        ? 'Glad we could help. Use Help me build it below anytime — Guidify will follow up from your draft.'
        : withOpenQuestion(
            'Sounds good. Use Help me build it below when you’re ready — we’ll refine anything left while preparing your quote.',
          );
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: draft,
        privateQuote: basePrivate(
          'M',
          52,
          declined
            ? 'Guest declined more help'
            : 'Soft affirmative after sample',
        ),
      });
      return { assistantMessage, draft, messages };
    }

    // Correction budget exhausted.
    if (
      step.id === 90 &&
      userText &&
      (Number(seeded.correctionCount) || 0) >= MAX_CORRECTIONS
    ) {
      const draft = sanitizeDraft({ ...seeded, offerHelp: true });
      const assistantMessage = withOpenQuestion(
        'We’ll figure out the rest while preparing your quote — use Help me build it below.',
      );
      messages.push({ role: 'assistant', content: assistantMessage });
      await this.leads.upsertDesignSession({
        sessionId: input.sessionId,
        clientIp: input.clientIp,
        messages,
        designDraft: draft,
        privateQuote: basePrivate('M', 52, 'Correction limit — defer to quote'),
      });
      return { assistantMessage, draft, messages };
    }

    let parsed: AgentJson;
    // Steps 4–5 stay scripted. Discovery (51+) and design use LLM when available.
    if (step.id <= 5) {
      parsed = scriptedFallback(messages, seeded);
    } else {
      parsed = await this.callModel(messages, step, seeded);
      parsed = {
        ...parsed,
        draft: mergeSeededContact(
          sanitizeDraft(parsed.draft || emptyDraft()),
          seeded,
        ),
      };
    }

    // Server-enforce discovery answers + completion.
    if (step.id === 51 && userText && !looksOffTopic(userText)) {
      const answers = [...(seeded.discoveryAnswers || [])];
      if (
        !answers.includes(userText) &&
        !wantsAccelerate(userText) &&
        !looksLikeIntegrationReply(userText)
      ) {
        answers.push(userText);
      }
      const capped = answers
        .filter((a) => !looksLikeIntegrationReply(a))
        .slice(0, MAX_DISCOVERY_QUESTIONS);
      const draft = parsed.draft || emptyDraft();
      draft.discoveryAnswers = capped;
      const transferSignal = /\b(transfer|gas smell|unsafe|not a fit|disqualif|bleeding|toxin|freezing|active leak)\b/i.test(
        userText,
      );
      if (
        draft.discoveryComplete ||
        capped.length >= MAX_DISCOVERY_QUESTIONS ||
        wantsAccelerate(userText) ||
        (transferSignal && capped.length >= 2)
      ) {
        draft.discoveryComplete = true;
      }
      // Keep discoveryComplete false until enough signal unless guest asked to proceed.
      if (
        !draft.discoveryComplete &&
        capped.length >= 3 &&
        Boolean(parsed.draft?.discoveryComplete)
      ) {
        draft.discoveryComplete = true;
      }
      draft.desiredResult =
        (draft.desiredResult || '').trim() ||
        [draft.useCase, ...capped.slice(0, 2)].filter(Boolean).join(' — ').slice(0, 500);
      applyRebrand(draft, userText);
      // Never keep a premature sample during discovery — package happens on step 12.
      if (!draft.discoveryComplete) {
        draft.sampleConversation = [];
      }
      // Discovery just completed: ask CRM or package now — never “I’ll prepare…” limbo.
      if (draft.discoveryComplete) {
        draft.sampleConversation = [];
        if (integrationUnset(draft.integrationInterest || seeded.integrationInterest)) {
          parsed.assistantMessage =
            'Any CRM or tools to connect — HubSpot, Salesforce, or none yet?';
          parsed.draft = draft;
        } else {
          const packed = ensureDesignPackage(
            mergeSeededContact(draft, seeded),
          );
          parsed.draft = packed;
          parsed.assistantMessage = wantsHireHelp(userText)
            ? `Here’s a sample of the agent in action. Guidify can build this with you — use Help me build it below.\n\n[[SAMPLE_CALL]]\n\nTell me what to change if anything.`
            : `Here’s a sample call based on what you shared.\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`;
        }
      } else {
        // Soft confirmations → one must-know question only.
        let msg = (parsed.assistantMessage || '').trim();
        if (/to confirm|is that correct|does that sound/i.test(msg)) {
          msg =
            DISCOVERY_QUESTIONS[Math.min(capped.length, DISCOVERY_QUESTIONS.length - 1)];
        }
        // Never offer Help me build it / claim a sample mid-discovery.
        draft.offerHelp = false;
        parsed.assistantMessage = enforceSingleQuestionMark(msg);
        parsed.draft = draft;
      }
    }

    // After design package turn, guarantee sample + lead fields exist.
    if (step.id === 12 && parsed.draft) {
      const merged = mergeSeededContact(parsed.draft, seeded);
      if (wantsHireHelp(userText)) merged.offerHelp = true;
      if (
        !(merged.sampleConversation || []).length ||
        isThinSample(merged.sampleConversation) ||
        isAwkwardSample(merged.sampleConversation) ||
        sampleMismatchesUseCase(merged) ||
        !/\[\[SAMPLE_CALL\]\]/i.test(parsed.assistantMessage || '')
      ) {
        const packed = ensureDesignPackage(merged);
        if (sampleMismatchesUseCase(packed)) {
          packed.sampleConversation = buildRichSample(packed);
        }
        parsed.draft = packed;
        if (!/\[\[SAMPLE_CALL\]\]/i.test(parsed.assistantMessage || '')) {
          parsed.assistantMessage = wantsHireHelp(userText)
            ? `Here’s a sample of the agent in action. Guidify can build this with you — use Help me build it below.\n\n[[SAMPLE_CALL]]\n\nTell me what to change if anything.`
            : `Here’s a sample call based on what you shared.\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`;
        }
      } else {
        parsed.draft = {
          ...merged,
          desiredResult:
            (merged.desiredResult || '').trim() ||
            [merged.useCase, ...(merged.discoveryAnswers || []).slice(0, 2)]
              .filter(Boolean)
              .join(' — ')
              .slice(0, 500),
          offerHelp: true,
          discoveryComplete: true,
        };
      }
    }

    // "I'll draft…" limbo without a sample → force package on accelerate / proceed.
    if (
      parsed.draft &&
      userText &&
      (accelerate || wantsAccelerate(userText)) &&
      (!(parsed.draft.sampleConversation || []).length ||
        !/\[\[SAMPLE_CALL\]\]/i.test(parsed.assistantMessage || '') ||
        /i(''|’)ll draft|i will draft|preparing your|working on (your|the) (agent|sample)/i.test(
          parsed.assistantMessage || '',
        ))
    ) {
      const packed = ensureDesignPackage(
        mergeSeededContact(parsed.draft, seeded),
      );
      if (wantsHireHelp(userText)) packed.offerHelp = true;
      parsed.draft = packed;
      parsed.assistantMessage = wantsHireHelp(userText)
        ? `Here’s a working sample. Guidify can take it from here — use Help me build it below.\n\n[[SAMPLE_CALL]]`
        : `Here’s a sample call based on what you shared.\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`;
    }

    // If we accelerated but the model still skipped the sample, force package.
    if (
      accelerate &&
      parsed.draft &&
      (!(parsed.draft.sampleConversation || []).length ||
        !/\[\[SAMPLE_CALL\]\]/i.test(parsed.assistantMessage || ''))
    ) {
      const packed = ensureDesignPackage(
        mergeSeededContact(parsed.draft, seeded),
      );
      if (wantsHireHelp(userText)) packed.offerHelp = true;
      parsed.draft = packed;
      parsed.assistantMessage = wantsHireHelp(userText)
        ? `Here’s a working sample. Guidify can take it from here — use Help me build it below.\n\n[[SAMPLE_CALL]]`
        : `Here’s a sample call based on what you shared.\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`;
    }

    // Increment correction count after a real correction turn.
    if (step.id === 90 && userText && isRealCorrection(userText)) {
      const draft = parsed.draft || emptyDraft();
      draft.correctionCount = Math.min(
        MAX_CORRECTIONS,
        (Number(seeded.correctionCount) || 0) + 1,
      );
      draft.offerHelp = true;
      // Keep desiredResult clean — don't append CRM/proceed noise.
      if (!(draft.desiredResult || '').trim()) {
        draft.desiredResult = [
          seeded.desiredResult || seeded.useCase || '',
          ...((seeded.discoveryAnswers || []).slice(0, 2)),
        ]
          .filter(Boolean)
          .join(' — ')
          .slice(0, 500);
      }

      const sayTok =
        userText.match(/\bsay\s+([A-Z][\w &.'-]{1,40})/i)?.[1]?.replace(
          /[.,;:]+$/,
          '',
        ) || '';
      if (sayTok) draft.spokenBrand = sayTok;
      if (/overgrown|backyard/i.test(userText)) {
        draft.sampleCallerHook = 'overgrown backyard';
      }
      draft.spokenBrand = draft.spokenBrand || seeded.spokenBrand || '';
      draft.sampleCallerHook =
        draft.sampleCallerHook || seeded.sampleCallerHook || '';

      const priorKey = sampleKey(seeded.sampleConversation);
      const nextKey = sampleKey(draft.sampleConversation);
      const awkward =
        isAwkwardSample(draft.sampleConversation) ||
        isThinSample(draft.sampleConversation);
      // Corrections must change the sample — never echo the rejected dialogue.
      if (!draft.sampleConversation?.length || nextKey === priorKey || awkward) {
        draft.sampleConversation = buildRichSample(draft, userText);
      }
      // Apply this turn + persisted brand/hook so stacked edits don't wipe earlier ones.
      let reapplyHint = userText;
      if ((draft.spokenBrand || '').trim()) {
        reapplyHint = `${reapplyHint} say ${draft.spokenBrand}`;
      }
      if ((draft.sampleCallerHook || '').trim()) {
        reapplyHint = `${reapplyHint} ${draft.sampleCallerHook}`;
      }
      draft.sampleConversation = applySampleCorrection(
        draft.sampleConversation,
        draft,
        reapplyHint,
      );
      // Preserve identity — model must not rename company to a CRM.
      draft.companyName = seeded.companyName;
      draft.contactEmail = seeded.contactEmail;
      draft.contactName = seeded.contactName;
      const changeNote = briefCorrectionNote(userText);
      parsed.assistantMessage = withOpenQuestion(
        `Updated — ${changeNote}\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`,
      );
      parsed.draft = draft;
    } else if (step.id === 90 && userText && !isSoftAffirmative(userText)) {
      // Non-correction chatter after sample — keep identity, nudge CTA.
      if (parsed.draft) {
        parsed.draft.companyName = seeded.companyName;
        parsed.draft.contactEmail = seeded.contactEmail;
        parsed.draft.contactName = seeded.contactName;
        parsed.draft.offerHelp = true;
      }
    }

    // Never allow empty, thin, or awkward samples through on package/refine beats.
    if (parsed.draft) {
      const merged = mergeSeededContact(parsed.draft, seeded);
      const sample = parsed.draft.sampleConversation;
      const needsSample =
        step.id === 12 ||
        step.id === 90 ||
        Boolean(parsed.draft.offerHelp) ||
        /\[\[SAMPLE_CALL\]\]/i.test(parsed.assistantMessage || '');
      if (
        needsSample &&
        (!(sample || []).length ||
          isThinSample(sample) ||
          isAwkwardSample(sample) ||
          sampleMismatchesUseCase(merged))
      ) {
        parsed.draft = ensureDesignPackage(merged);
        if (
          isThinSample(parsed.draft.sampleConversation) ||
          isAwkwardSample(parsed.draft.sampleConversation) ||
          sampleMismatchesUseCase(parsed.draft)
        ) {
          parsed.draft.sampleConversation = buildRichSample(
            parsed.draft,
            step.id === 90 ? userText : undefined,
          );
        }
      } else if (
        sample?.length &&
        (isThinSample(sample) || isAwkwardSample(sample))
      ) {
        parsed.draft.sampleConversation = buildRichSample(
          merged,
          step.id === 90 ? userText : undefined,
        );
      }
    }

    const assistantMessage = stripPrivateEstimatesFromVisitorText(
      parsed.assistantMessage?.trim() ||
        `In one plain sentence, what does ${seeded.companyName} do?`,
    );
    let draft = sanitizeDraft(parsed.draft || seeded);
    // Never rename the company to a CRM / tool after intake.
    draft.companyName = seeded.companyName || draft.companyName;
    draft.contactEmail = seeded.contactEmail || draft.contactEmail;
    draft.contactName = seeded.contactName || draft.contactName;
    applyRebrand(draft, userText);

    // If the draft has a sample, the guest must see it this turn — but only on
    // design/correction beats (never mid-discovery).
    let visible = stripIdentityReask(assistantMessage, draft);
    if (step.id === 51) {
      visible = visible.replace(/\n*\[\[SAMPLE_CALL\]\]\n*/gi, '\n').trim();
      visible = enforceSingleQuestionMark(stripIdentityReask(visible, draft));
    } else if (
      (step.id === 12 || step.id === 90) &&
      (draft.sampleConversation || []).length >= 10 &&
      !/\[\[SAMPLE_CALL\]\]/i.test(visible)
    ) {
      visible = `${visible}\n\n[[SAMPLE_CALL]]`.trim();
    }
    // Model said “sample” but forgot the marker — force it when we have lines.
    if (
      (step.id === 12 || step.id === 90) &&
      (draft.sampleConversation || []).length >= 10 &&
      /sample (call|of the agent|voice agent)/i.test(visible) &&
      !/\[\[SAMPLE_CALL\]\]/i.test(visible)
    ) {
      visible = `${visible}\n\n[[SAMPLE_CALL]]`.trim();
    }
    // offerHelp without a rich sample → pack + show marker (never empty CTA).
    if (
      (step.id === 12 || step.id === 90) &&
      (draft.offerHelp || /help me build it/i.test(visible)) &&
      isThinSample(draft.sampleConversation)
    ) {
      draft = ensureDesignPackage(mergeSeededContact(draft, seeded));
      if (isThinSample(draft.sampleConversation)) {
        draft.sampleConversation = buildRichSample(draft, userText);
      }
      if (!/\[\[SAMPLE_CALL\]\]/i.test(visible)) {
        visible = `Here’s a sample call based on what you shared.\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`;
      }
    }
    // Closing / sample / correction beats always leave an open help question.
    // After first sample, if CRM still unknown, ask that instead of open-help.
    if (
      step.id === 12 &&
      userText &&
      !wantsGuestExit(userText) &&
      integrationUnset(draft.integrationInterest)
    ) {
      visible = visible
        .replace(/\n*Is there anything else I can help with\??\s*$/i, '')
        .trim();
      if (!/crm|tools to (connect|integrate)|hubspot|salesforce|or none/i.test(visible)) {
        visible = `${visible}\n\nAny CRM or tools to connect — or say none?`;
      }
      visible = enforceSingleQuestionMark(visible);
    } else if (
      (step.id === 12 || step.id === 90) &&
      userText &&
      !wantsGuestExit(userText) &&
      !declinesMoreHelp(userText) &&
      !draft.declinedMoreHelp
    ) {
      visible = withOpenQuestion(visible);
    }
    const privateQuote = sanitizePrivate(parsed.private);

    messages.push({ role: 'assistant', content: visible });

    await this.leads.upsertDesignSession({
      sessionId: input.sessionId,
      clientIp: input.clientIp,
      messages,
      designDraft: draft,
      privateQuote,
    });

    // Fire-and-forget hot-lead email (once per session when signaled or heuristic).
    void this.leads
      .maybeNotifyHotLead({
        sessionId: input.sessionId,
        draft,
        privateQuote,
        messages,
      })
      .catch((err) => console.warn('[design] hot-lead notify failed', err));

    return { assistantMessage: visible, draft, messages };
  }

  private async callModel(
    messages: ChatMessage[],
    step: InterviewStep,
    seeded: DesignDraftPublic,
  ): Promise<AgentJson> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return scriptedFallback(messages, seeded);
    }

    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
    const lastUser =
      [...messages].reverse().find((m) => m.role === 'user')?.content.trim() ||
      '';
    const stepLock = [
      `HARD RULE — THIS TURN ONLY: interview step ${step.id} — ${step.label}.`,
      `You MUST: ${step.instruction}`,
      'Do not ask about later steps. Do not reopen completed intake fields unless the guest corrects them.',
      `Known draft: company=${seeded.companyName || '—'}; contact=${seeded.contactName || '—'}; does=${seeded.companyDoes || '—'}; useCase=${seeded.useCase || '—'}; discovery=${(seeded.discoveryAnswers || []).length}/${MAX_DISCOVERY_QUESTIONS} complete=${Boolean(seeded.discoveryComplete)}; corrections=${Number(seeded.correctionCount) || 0}/${MAX_CORRECTIONS}.`,
      `Discovery notes (for design only — NEVER paste into caller dialogue): ${(seeded.discoveryAnswers || []).join(' | ') || '—'}`,
      step.id === 12 || step.id === 90
        ? [
            'Sample must be a wow demo of human-like phone dialogue.',
            'Professional helpful bot; natural caller; complete sentences; no mid-word cutoffs.',
            'Never put CSAT / analytics / funnel jargon in spoken lines.',
            'Never dump discovery notes as caller speech.',
            'Use [[SAMPLE_CALL]].',
          ].join(' ')
        : '',
      step.id === 90 && lastUser
        ? `GUEST CORRECTION (honor fully, rewrite sampleConversation — do not repeat the previous sample): ${lastUser}`
        : '',
      step.id >= 90 || step.id === 12
        ? 'Set draft.offerHelp=true when inviting Help me build it.'
        : 'Keep draft.offerHelp=false until sample / help-offer.',
      'Never mention hours, day counts, complexity letters, price, numeric caps, or that you flagged a hot lead in assistantMessage.',
      'When the visitor is clearly worth Guidify attention, set private.hotLead=true with a short hotLeadReason (silent to the visitor).',
    ]
      .filter(Boolean)
      .join('\n');

    const body = {
      model,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: DESIGN_MASTER_SYSTEM },
        { role: 'system', content: knowledgeBasePromptBlock() },
        { role: 'system', content: stepLock },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        console.warn('[design] openai error', res.status, text.slice(0, 400));
        return scriptedFallback(messages, seeded);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content || '{}';
      return JSON.parse(raw) as AgentJson;
    } catch (err) {
      console.warn('[design] openai failed', err);
      return scriptedFallback(messages, seeded);
    }
  }
}

function emptyDraft(): DesignDraftPublic {
  return {
    companyName: '',
    contactEmail: '',
    contactName: '',
    companyDoes: '',
    useCase: '',
    product: '',
    vertical: '',
    desiredResult: '',
    discoveryAnswers: [],
    discoveryComplete: false,
    portals: [...DEFAULT_PORTALS],
    flowNodes: [...DEFAULT_FLOW],
    funnels: [],
    analyticsEvents: [],
    sampleConversation: [],
    integrationInterest: '',
    refinementOffer: '',
    offerHelp: false,
    declinedMoreHelp: false,
    spokenBrand: '',
    sampleCallerHook: '',
    correctionCount: 0,
    unansweredQuestions: [],
  };
}

/** Defense in depth — never leak hour/day quote language or metrics jargon to the visitor. */
export function stripPrivateEstimatesFromVisitorText(text: string): string {
  let out = text;
  out = out.replace(/\b\d+\s*[-–]?\s*\d*\s*(hours?|hrs?)\b/gi, '');
  out = out.replace(/\b(about|approx(?:imately)?|around|~)?\s*\d+\s*(hours?|hrs?)\b/gi, '');
  out = out.replace(/\b(quote|estimate)\s*(is|:)?\s*\d+\b/gi, 'we can scope this with you');
  out = out.replace(/\b(complexity|tier)\s*[:=]?\s*(S|M|L|XL)\b/gi, '');
  out = out.replace(/\b(CSAT|AHT|containment rate|NPS)\b/gi, 'call quality');
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return out || "Thanks — let's keep shaping this together.";
}

function sanitizeDraft(d: DesignDraftPublic): DesignDraftPublic {
  const companyName = String(d.companyName || d.product || '').slice(0, 200);
  return {
    companyName,
    contactEmail: String(d.contactEmail || '').slice(0, 320),
    contactName: String(d.contactName || '').slice(0, 200),
    companyDoes: String(d.companyDoes || d.vertical || '').slice(0, 500),
    useCase: sanitizeUseCase(String(d.useCase || '')),
    product: companyName,
    vertical: String(d.vertical || d.companyDoes || '').slice(0, 200),
    desiredResult: String(d.desiredResult || '').slice(0, 500),
    discoveryAnswers: Array.isArray(d.discoveryAnswers)
      ? d.discoveryAnswers
          .map((a) => String(a).slice(0, 500))
          .filter((a) => a && !looksLikeIntegrationReply(a))
          .slice(0, MAX_DISCOVERY_QUESTIONS)
      : [],
    discoveryComplete: Boolean(d.discoveryComplete),
    portals: Array.isArray(d.portals)
      ? d.portals.map((p) => String(p)).slice(0, 12)
      : [...DEFAULT_PORTALS],
    flowNodes: Array.isArray(d.flowNodes)
      ? d.flowNodes.slice(0, 14).map((n, i) => ({
          id: String(n.id || `n${i}`).slice(0, 64),
          label: String(n.label || `Step ${i + 1}`).slice(0, 80),
          kind: n.kind ? String(n.kind).slice(0, 32) : undefined,
        }))
      : [...DEFAULT_FLOW],
    funnels: Array.isArray(d.funnels)
      ? d.funnels.slice(0, 6).map((f, i) => ({
          id: String(f.id || `f${i}`).slice(0, 64),
          label: String(f.label || `Funnel ${i + 1}`).slice(0, 80),
          steps: Array.isArray(f.steps)
            ? f.steps.map((s) => String(s).slice(0, 80)).slice(0, 10)
            : [],
        }))
      : [],
    analyticsEvents: Array.isArray(d.analyticsEvents)
      ? d.analyticsEvents.slice(0, 16).map((e, i) => ({
          tag: String(e.tag || `event_${i}`).slice(0, 64),
          funnelId: String(e.funnelId || '').slice(0, 64),
          step: String(e.step || '').slice(0, 80),
          why: String(e.why || '').slice(0, 240),
        }))
      : [],
    sampleConversation: Array.isArray(d.sampleConversation)
      ? d.sampleConversation.slice(0, 16).map((line) => ({
          role: line.role === 'caller' ? 'caller' : 'bot',
          text: String(line.text || '').slice(0, 280),
        }))
      : [],
    integrationInterest: String(d.integrationInterest || '').slice(0, 400),
    refinementOffer: String(d.refinementOffer || '').slice(0, 400),
    offerHelp: Boolean(d.offerHelp),
    declinedMoreHelp: Boolean(d.declinedMoreHelp),
    spokenBrand: String(d.spokenBrand || '').slice(0, 80),
    sampleCallerHook: String(d.sampleCallerHook || '').slice(0, 200),
    correctionCount: Math.max(
      0,
      Math.min(MAX_CORRECTIONS, Math.round(Number(d.correctionCount) || 0)),
    ),
    unansweredQuestions: Array.isArray(d.unansweredQuestions)
      ? d.unansweredQuestions.map((q) => String(q).slice(0, 500)).filter(Boolean).slice(0, 40)
      : [],
  };
}

function sanitizePrivate(p?: PrivateQuote | null): PrivateQuote {
  if (!p) {
    return {
      complexity: 'M',
      quoteHours: 40,
      baseHours: 40,
      integrationHours: 0,
      integrationKind: 'none',
      rationale: 'default',
    };
  }
  const base = Number(p.baseHours);
  const integ = Number(p.integrationHours);
  const kind = String(p.integrationKind || 'none').toLowerCase();
  const integrationKind =
    kind === 'common' || kind === 'custom' || kind === 'none' ? kind : 'none';
  const baseHours = Number.isFinite(base)
    ? Math.max(8, Math.min(320, Math.round(base)))
    : 40;
  // Common integrations are not billed — force 0.
  const integrationHours =
    integrationKind === 'custom' && Number.isFinite(integ)
      ? Math.max(0, Math.min(200, Math.round(integ)))
      : 0;
  const total = Number(p.quoteHours);
  const quoteHours = Number.isFinite(total)
    ? Math.max(8, Math.min(400, Math.round(total)))
    : baseHours + integrationHours;
  return {
    complexity: String(p.complexity || 'M').slice(0, 8),
    quoteHours,
    baseHours,
    integrationHours,
    integrationKind,
    integrationNotes: String(p.integrationNotes || '').slice(0, 500),
    rationale: String(p.rationale || '').slice(0, 500),
    hotLead: Boolean(p.hotLead),
    hotLeadReason: String(p.hotLeadReason || '').slice(0, 400),
    unansweredQuestions: Array.isArray(p.unansweredQuestions)
      ? p.unansweredQuestions
          .map((q) => String(q).slice(0, 500))
          .filter(Boolean)
          .slice(0, 40)
      : [],
  };
}

/** Scripted path after contact form — discovery, rich sample, corrections. */
function scriptedFallback(
  messages: ChatMessage[],
  prior: DesignDraftPublic,
): AgentJson {
  const draft: DesignDraftPublic = {
    ...emptyDraft(),
    ...prior,
    portals: prior.portals?.length ? prior.portals : [...DEFAULT_PORTALS],
    discoveryAnswers: [...(prior.discoveryAnswers || [])],
  };
  const company = (draft.companyName || '').slice(0, 40);
  const email = draft.contactEmail || '';
  const contactName = draft.contactName || '';
  const last =
    [...messages].reverse().find((m) => m.role === 'user')?.content.trim() ||
    '';

  if (!contactComplete(draft)) {
    return {
      assistantMessage:
        'Please complete the contact form (company, email, and name) to continue.',
      draft,
      private: basePrivate('S', 24, 'Contact form required'),
    };
  }

  if (!(draft.companyDoes || '').trim()) {
    if (!last) {
      return {
        assistantMessage: `In one plain sentence, what does ${company || 'your company'} do?`,
        draft,
        private: basePrivate('S', 28, 'Awaiting company description'),
      };
    }
    draft.companyDoes = last.slice(0, 500);
    draft.vertical = draft.companyDoes;
    if (/rebranded|we are /i.test(last)) {
      applyRebrand(draft, last);
      if (!(draft.companyDoes || '').trim()) {
        draft.companyDoes = last.slice(0, 500);
        draft.vertical = draft.companyDoes;
      }
    }
    return {
      assistantMessage:
        'What would you like to try first with Vapi Studio — lead collection, FAQ answers, booking, qualify, or something else?',
      draft,
      private: basePrivate('S', 32, 'Company description captured'),
    };
  }

  if (!(draft.useCase || '').trim()) {
    // Rebrand / company-does message must not be reused as the use case.
    const lastIsCompanyEcho =
      !last ||
      last === draft.companyDoes ||
      /rebranded|we are /i.test(last);
    if (lastIsCompanyEcho) {
      return {
        assistantMessage:
          'What would you like to try first with Vapi Studio — lead collection, FAQ answers, booking, qualify, or something else?',
        draft,
        private: basePrivate('S', 32, 'Awaiting use case'),
      };
    }
    // Vague explorer — propose a concrete default instead of wobbling.
    if (
      /^(not sure|i guess|maybe|whatever|idk|unsure)\b/i.test(last) ||
      /^(maybe )?voice ai\??$/i.test(last.trim())
    ) {
      const proposed = /market/i.test(draft.companyDoes || '')
        ? 'Qualify inbound website leads and book a short discovery call'
        : 'Qualify inbound leads and route strong ones to a human';
      draft.useCase = proposed;
      draft.desiredResult = proposed;
      return {
        assistantMessage: `Let’s lock a clear default: ${proposed}. ${DISCOVERY_QUESTIONS[0]}`,
        draft,
        private: basePrivate('M', 36, `Proposed use case from vague reply: ${proposed}`),
      };
    }
    draft.useCase = sanitizeUseCase(last);
    draft.desiredResult = draft.useCase;
    return {
      assistantMessage: DISCOVERY_QUESTIONS[0],
      draft,
      private: basePrivate('M', 36, `Use case: ${draft.useCase.slice(0, 80)}`),
    };
  }

  // Discovery (up to 7)
  if (!draft.discoveryComplete) {
    if (
      last &&
      last !== draft.companyDoes &&
      last !== draft.useCase &&
      !(draft.discoveryAnswers || []).includes(last) &&
      !looksLikeIntegrationReply(last) &&
      !wantsAccelerate(last)
    ) {
      draft.discoveryAnswers = [...(draft.discoveryAnswers || []), last].slice(
        0,
        MAX_DISCOVERY_QUESTIONS,
      );
    }
    const answers = draft.discoveryAnswers || [];
    const proceed =
      /proceed|draft|ready|nothing else|that's all|thats all|nope|no more|go ahead/i.test(
        last,
      );
    if (answers.length >= MAX_DISCOVERY_QUESTIONS || (proceed && answers.length >= 3)) {
      draft.discoveryComplete = true;
    } else if (answers.length < MAX_DISCOVERY_QUESTIONS) {
      const q = DISCOVERY_QUESTIONS[answers.length] || DISCOVERY_QUESTIONS[DISCOVERY_QUESTIONS.length - 1];
      // Offer early exit only near the end of discovery (avoid nagging every turn).
      if (answers.length >= 5) {
        return {
          assistantMessage: `${q} Or say “proceed” and I’ll draft the flow.`,
          draft,
          private: basePrivate('M', 40, `Discovery ${answers.length}/${MAX_DISCOVERY_QUESTIONS}`),
        };
      }
      return {
        assistantMessage: q,
        draft,
        private: basePrivate('M', 40, `Discovery ${answers.length}/${MAX_DISCOVERY_QUESTIONS}`),
      };
    }
  }

  const useCase = draft.useCase || '';
  const funnelId = 'primary';
  const funnelLabel =
    /faq|question|inform/i.test(useCase)
      ? 'FAQ resolution'
      : /book|appoint/i.test(useCase)
        ? 'Booking'
        : /qualif/i.test(useCase)
          ? 'Lead qualification'
          : 'Lead intake';

  if (!(draft.funnels || []).length || !(draft.analyticsEvents || []).length) {
    draft.funnels = [
      {
        id: funnelId,
        label: funnelLabel,
        steps: ['Start', 'Need', 'Qualify', 'Decision', 'Complete'],
      },
    ];
    draft.flowNodes = simpleFlowFor(useCase);
    draft.portals = [...DEFAULT_PORTALS];
    draft.analyticsEvents = [
      {
        tag: 'conversation_started',
        funnelId,
        step: 'Start',
        why: 'Entry volume for this funnel.',
      },
      {
        tag: 'need_identified',
        funnelId,
        step: 'Need',
        why: 'Separates curiosity from real intent.',
      },
      {
        tag: 'qualified',
        funnelId,
        step: 'Qualify',
        why: 'Shows how often callers meet your success criteria.',
      },
      {
        tag: 'funnel_completed',
        funnelId,
        step: 'Complete',
        why: `North-star for “${funnelLabel}” success.`,
      },
    ];
    return {
      assistantMessage: `Based on what you shared, proposed funnel: ${funnelLabel} (Start → Need → Qualify → Decision → Complete), with events on each step. Any CRM or tools to connect?`,
      draft,
      private: basePrivate('M', 48, `Funnel + events for ${funnelLabel}`),
    };
  }

  if (!(draft.integrationInterest || '').trim() || !(draft.sampleConversation || []).length) {
    if (!(draft.integrationInterest || '').trim() && last && !(draft.sampleConversation || []).length) {
      // Could be answering integrations OR still mid-funnel affirm — treat as integrations if funnel exists.
      draft.integrationInterest = last.slice(0, 400);
    }
  }

  const custom = /custom|proprietary|internal api|bespoke/i.test(
    draft.integrationInterest || last,
  );
  const common = /hubspot|salesforce|twilio|vapi|crm|none|no\b|skip/i.test(
    draft.integrationInterest || last || 'none',
  );
  const integrationKind = custom ? 'custom' : 'common';
  const integrationHours = integrationKind === 'custom' ? 24 : 0;
  if (!(draft.integrationInterest || '').trim()) {
    draft.integrationInterest = last || 'none';
  }

  draft.sampleConversation = buildRichSample(draft);
  draft.refinementOffer =
    'Tell us what to change, or use Help me build it below.';
  draft.offerHelp = true;

  const used = Number(draft.correctionCount) || 0;
  if ((prior.sampleConversation || []).length && last && !isSoftAffirmative(last)) {
    draft.correctionCount = Math.min(MAX_CORRECTIONS, used + 1);
    draft.desiredResult = [
      draft.desiredResult || draft.useCase || '',
      `Guest correction: ${last}`,
    ]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 500);
    draft.sampleConversation = buildRichSample(draft, last);
    return {
      assistantMessage: `Agreed — I’ve revised the sample so it reads like a real, professional call.\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`,
      draft,
      private: {
        complexity: integrationKind === 'custom' ? 'L' : 'M',
        quoteHours: 52 + integrationHours,
        baseHours: 52,
        integrationHours,
        integrationKind,
        integrationNotes: (draft.integrationInterest || '').slice(0, 200),
        rationale: `Correction ${draft.correctionCount}`,
      },
    };
  }

  return {
    assistantMessage: `Here is a sample of how the call can feel — grounded in what you said matters:\n\n[[SAMPLE_CALL]]\n\nTell me what to change, or use Help me build it below.`,
    draft,
    private: {
      complexity: integrationKind === 'custom' ? 'L' : 'M',
      quoteHours: 48 + integrationHours,
      baseHours: 48,
      integrationHours,
      integrationKind,
      integrationNotes: (draft.integrationInterest || '').slice(0, 200),
      rationale: 'Rich sample + help offer',
      hotLead: true,
      hotLeadReason: `${draft.companyName || 'Lead'} completed discovery + sample (${draft.useCase || 'use case'})`,
    },
  };
}

function sampleKey(
  sample: DesignDraftPublic['sampleConversation'] | undefined,
): string {
  return (sample || []).map((l) => `${l.role}:${l.text}`).join('\n');
}

function isThinSample(
  sample: DesignDraftPublic['sampleConversation'] | undefined,
): boolean {
  // Doctrine + eval harness: rich samples are 10–16 spoken lines (never ≤7).
  if (!sample || sample.length < 10) return true;
  const text = sample.map((l) => l.text).join(' ').toLowerCase();
  const identityHeavy =
    /(name and email|may i get your name)/.test(text) &&
    !/(qualif|urgent|repair|book|appoint|faq|transfer|timeline|budget|service|schedule|hours|policy|cleanup|overgrown)/.test(
      text,
    );
  return identityHeavy;
}

/** After intake, never re-ask name / email / company. */
function stripIdentityReask(
  msg: string,
  draft: DesignDraftPublic,
): string {
  const hasId = Boolean(
    (draft.companyName || '').trim() &&
      (draft.contactEmail || '').trim() &&
      (draft.contactName || '').trim(),
  );
  if (!hasId) return msg;
  if (
    !/\b(what('?s| is) your (name|email|company)|company name|may i (have|get) your name|who am i speaking|email address)\b/i.test(
      msg,
    )
  ) {
    return msg;
  }
  const first = (draft.contactName || 'there').split(/\s+/)[0];
  return enforceSingleQuestionMark(
    `Thanks ${first} — I’ve got ${draft.companyName}. What’s the most important thing the agent should handle on each call?`,
  );
}

/** Catches jargon dumps / truncated mashups that are not spoken dialogue. */
function isAwkwardSample(
  sample: DesignDraftPublic['sampleConversation'] | undefined,
): boolean {
  if (!sample?.length) return false;
  for (const line of sample) {
    const t = String(line.text || '').trim();
    if (!t) return true;
    if (/\b(CSAT|NPS|funnel_completed|analytics|north-star|KPI)\b/i.test(t)) {
      return true;
    }
    if (/trying to underst|resolved at least one question on a call/i.test(t)) {
      return true;
    }
    // Truncated / unfinished spoken line
    if (t.length > 40 && !/[.!?)]$/.test(t) && /\s\w{1,7}$/i.test(t)) {
      return true;
    }
    // Mashup of multiple discovery answers
    if (
      line.role === 'caller' &&
      t.length > 70 &&
      /CSAT|Different people|success criteria/i.test(t)
    ) {
      return true;
    }
  }
  return false;
}

function sampleMismatchesUseCase(draft: DesignDraftPublic): boolean {
  const uc = (draft.useCase || '').toLowerCase();
  const context = [
    draft.useCase,
    draft.companyDoes,
    ...(draft.discoveryAnswers || []),
  ]
    .join(' ')
    .toLowerCase();
  const text = (draft.sampleConversation || [])
    .map((l) => l.text)
    .join(' ')
    .toLowerCase();
  if (!uc || !text) return false;
  if (
    /dispatch|eta|pickup|tracking|freight|logistics/.test(uc) &&
    /new project|decision-maker/.test(text) &&
    !/tracking|pickup|eta|driver/.test(text)
  ) {
    return true;
  }
  if (
    (/roadside|fleet|van/.test(context) || /roadside|fleet/.test(uc)) &&
    !/(location|where|highway|urgent|urgency)/.test(text)
  ) {
    return true;
  }
  if (
    /book|appoint|mow|cleanup|dental|vet/.test(uc) &&
    /new project/.test(text) &&
    !/book|visit|appoint|cleanup|pet|exam/.test(text)
  ) {
    return true;
  }
  if (
    /faq|triage|support/.test(uc) &&
    /new project|decision-maker/.test(text) &&
    !/login|invoice|password|question|wrong/.test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Human-like sample. Never paste discovery notes into caller speech.
 * Optional correctionHint steers tone when the guest rejected a prior sample.
 */
function briefCorrectionNote(hint: string): string {
  const h = hint.trim();
  if (/shorter|too long|compress/i.test(h)) return 'shortened the sample.';
  if (/triage|what broke|ask what/i.test(h)) return 'triage comes first now.';
  if (/overgrown|backyard/i.test(h)) return 'caller opens with the overgrown backyard.';
  if (/\bsay\s+/i.test(h) || /greeting/i.test(h)) return 'greeting uses your brand name.';
  if (/csat|metrics|jargon/i.test(h)) return 'no metrics jargon in spoken lines.';
  if (/closing/i.test(h)) return 'closing is shorter.';
  return 'sample updated from your note.';
}

function applySampleCorrection(
  sample: NonNullable<DesignDraftPublic['sampleConversation']>,
  draft: DesignDraftPublic,
  hint: string,
): NonNullable<DesignDraftPublic['sampleConversation']> {
  let out = sample.map((l) => ({ role: l.role, text: String(l.text || '') }));
  const company = draft.companyName || 'us';
  const say =
    hint.match(/\bsay\s+([A-Z][\w &.'-]{1,40})/i)?.[1]?.replace(/[.,;:]+$/, '') ||
    (/greeting/i.test(hint) ? company.split(/\s+/)[0] : null);
  if (say) {
    out = out.map((l) => {
      if (
        l.role === 'bot' &&
        (/thanks for calling|thank you for calling|hello[, ]|hi[, ]/i.test(l.text) ||
          /^hello[, ]/i.test(l.text) ||
          /this is .+/i.test(l.text))
      ) {
        return {
          role: 'bot',
          text: `Thanks for calling ${say}. How can I help you today?`,
        };
      }
      return l;
    });
  }
  if (/overgrown|backyard/i.test(hint)) {
    const idx = out.findIndex((l) => l.role === 'caller');
    if (idx >= 0) {
      out[idx] = {
        role: 'caller',
        text: 'I need a quote — backyard is overgrown and needs a spring cleanup.',
      };
    }
  }
  if (/triage-first|what broke|ask what/i.test(hint)) {
    return buildRichSample({ ...draft, useCase: 'faq support triage' }, hint);
  }
  if (/shorter closing|shorter sample|too long|shorter\b/i.test(hint)) {
    out = out.slice(0, Math.min(out.length, 8));
    if (out.length && out[out.length - 1].role === 'caller') {
      out.push({
        role: 'bot',
        text: 'You’re set. Thanks for calling — goodbye.',
      });
    } else if (out.length) {
      out[out.length - 1] = {
        role: 'bot',
        text: 'You’re set. Thanks for calling — goodbye.',
      };
    }
  }
  if (/csat|metrics|jargon|do not put/i.test(hint)) {
    out = out.map((l) => ({
      ...l,
      text: l.text
        .replace(/\b(CSAT|AHT|NPS|containment rate)\b/gi, 'how the call went')
        .replace(/resolved at least one question on a call/gi, 'got you an answer'),
    }));
  }
  return out;
}

function buildRichSample(
  draft: DesignDraftPublic,
  correctionHint?: string,
): NonNullable<DesignDraftPublic['sampleConversation']> {
  const company = draft.companyName || 'us';
  const brand =
    correctionHint?.match(/\bsay\s+([A-Z][\w &.'-]{1,40})/i)?.[1]?.replace(
      /[.,;:]+$/,
      '',
    ) ||
    (draft.spokenBrand || '').trim() ||
    company;
  const useCase = (draft.useCase || '').toLowerCase();
  const first = (draft.contactName || 'Alex').split(/\s+/)[0] || 'Alex';
  const wantsNatural =
    !correctionHint ||
    /human|natural|speak|jargon|CSAT|sense|weird|robot|dialog|dialogue|wow|professional/i.test(
      correctionHint,
    );

  if (
    /faq|question|inform|triage/.test(useCase) ||
    (/faq|question|csat|support|triage|what broke/i.test(correctionHint || '') &&
      wantsNatural)
  ) {
    // Triage-first FAQ: caller opens with a specific question (never metrics/discovery dumps).
    return [
      { role: 'bot', text: `Thanks for calling ${brand}. What’s going wrong today?` },
      {
        role: 'caller',
        text: 'I can’t log in — and I need a copy of my last invoice.',
      },
      {
        role: 'bot',
        text: 'Got it — login first. What’s the email on the account?',
      },
      { role: 'caller', text: 'sam@ledgerly.test' },
      {
        role: 'bot',
        text: 'I found the account. I can reset the password now, then send the invoice PDF. Want both?',
      },
      { role: 'caller', text: 'Yes — both, please.' },
      {
        role: 'bot',
        text: 'Password reset is on the way, and the invoice is emailed. Anything else on billing or bank sync?',
      },
      { role: 'caller', text: 'No — that covers it.' },
      {
        role: 'bot',
        text: 'Great. If a refund or account deletion comes up later, I’ll connect you to a person.',
      },
      { role: 'caller', text: 'Understood. Thanks.' },
      { role: 'bot', text: 'Glad I could help. Take care — goodbye.' },
    ];
  }

  // Roadside / fleet before generic booking.
  if (
    /roadside|fleet|van repair|mobile fleet|delivery van/.test(useCase) ||
    /roadside|fleet|highway|urgency|vehicle type/i.test(
      [correctionHint, draft.companyDoes, ...(draft.discoveryAnswers || [])].join(
        ' ',
      ),
    )
  ) {
    return [
      {
        role: 'bot',
        text: `Thanks for calling ${brand}. Are you calling about a roadside repair?`,
      },
      {
        role: 'caller',
        text: "Yes — my van won't start and I'm stuck on the highway.",
      },
      {
        role: 'bot',
        text: 'Got it. What type of vehicle is it, and where are you right now?',
      },
      { role: 'caller', text: "Ford Transit — I'm on I-4 near exit 7." },
      {
        role: 'bot',
        text: 'How urgent is this — can you wait about 45 minutes, or do you need someone sooner?',
      },
      { role: 'caller', text: 'Sooner if possible — cargo is time-sensitive.' },
      {
        role: 'bot',
        text: 'Understood. What’s the best mobile number for the tech to reach you?',
      },
      { role: 'caller', text: '416-555-0199.' },
      {
        role: 'bot',
        text: "I'll dispatch a tech to your location and text an ETA to that number. Anything else?",
      },
      { role: 'caller', text: "That's all." },
      { role: 'bot', text: 'Help is on the way. Take care — goodbye.' },
    ];
  }

  if (/book|appoint|mow|cleanup|landscap|dental|vet/.test(useCase)) {
    const callerOpen = /overgrown|backyard/i.test(correctionHint || '')
      ? 'I need a quote — backyard is overgrown and needs a spring cleanup.'
      : 'Yes — sometime this week if possible.';
    const closing = /shorter/i.test(correctionHint || '')
      ? ([
          { role: 'bot', text: `Thanks for calling ${brand}. Are you looking to book a visit?` },
          { role: 'caller', text: callerOpen },
          {
            role: 'bot',
            text: 'Happy to help. What do you need done, and is timing flexible or urgent?',
          },
          { role: 'caller', text: 'Spring cleanup. Flexible is fine.' },
          {
            role: 'bot',
            text: 'I have Thursday at 10am or Friday at 2pm. Which works better?',
          },
          { role: 'caller', text: 'Thursday at 10.' },
          {
            role: 'bot',
            text: 'Thursday at 10am — I’ll hold it and send a confirmation. Sound good?',
          },
          { role: 'caller', text: 'Yes.' },
          {
            role: 'bot',
            text: 'You’re booked. You’ll get a confirmation shortly. Anything else?',
          },
          { role: 'caller', text: 'That’s everything.' },
          { role: 'bot', text: 'Perfect — you’re all set. Goodbye.' },
        ] as NonNullable<DesignDraftPublic['sampleConversation']>)
      : null;
    if (closing) return closing;
    return [
      { role: 'bot', text: `Thanks for calling ${brand}. Are you looking to book a visit?` },
      { role: 'caller', text: callerOpen },
      {
        role: 'bot',
        text: 'Happy to help. What do you need done, and is the timing flexible or urgent?',
      },
      { role: 'caller', text: 'An inspection. Flexible is fine.' },
      {
        role: 'bot',
        text: 'I have Thursday at 10am or Friday at 2pm. Which works better?',
      },
      { role: 'caller', text: 'Thursday at 10.' },
      {
        role: 'bot',
        text: 'Thursday at 10am. I’ll hold that and send a confirmation. Sound good?',
      },
      { role: 'caller', text: 'Yes, please.' },
      {
        role: 'bot',
        text: 'You’re booked. You’ll get a confirmation shortly. Anything else before we wrap up?',
      },
      { role: 'caller', text: 'That’s everything.' },
      { role: 'bot', text: 'Perfect — you’re all set. Goodbye.' },
    ];
  }

  if (/dispatch|eta|pickup|tracking|freight|logistics|driver/.test(useCase)) {
    const shorter = /shorter|too long|compress/i.test(correctionHint || '');
    if (shorter) {
      return [
        {
          role: 'bot',
          text: `Thanks for calling ${brand}. Do you have a tracking number or the phone on the order?`,
        },
        { role: 'caller', text: 'Tracking 48291.' },
        {
          role: 'bot',
          text: 'Found it. Pickup is still 2–4pm today — want me to confirm that window?',
        },
        { role: 'caller', text: 'Yes, please confirm.' },
        {
          role: 'bot',
          text: 'Confirmed. Driver ETA is about 35 minutes. Want a text when they’re nearby?',
        },
        { role: 'caller', text: 'Yes, text me.' },
        {
          role: 'bot',
          text: 'Done — you’ll get the text. Anything else on this shipment?',
        },
        { role: 'caller', text: 'That’s all.' },
        {
          role: 'bot',
          text: 'You’re set. Thanks for calling — goodbye.',
        },
        { role: 'caller', text: 'Bye.' },
        { role: 'bot', text: 'Goodbye.' },
      ];
    }
    return [
      {
        role: 'bot',
        text: `Thanks for calling ${brand}. Do you have a tracking number or the phone on the order?`,
      },
      { role: 'caller', text: 'Tracking 48291.' },
      {
        role: 'bot',
        text: 'Got it. I see a pickup window of 2–4pm today — is that still right?',
      },
      { role: 'caller', text: 'Yes, 2–4pm works.' },
      {
        role: 'bot',
        text: 'Confirmed. Your driver ETA is about 35 minutes. Want a text when they’re nearby?',
      },
      { role: 'caller', text: 'Yes, please.' },
      {
        role: 'bot',
        text: 'Done — you’ll get the text. Anything else before we wrap up?',
      },
      { role: 'caller', text: 'No, that’s it.' },
      {
        role: 'bot',
        text: 'If the ETA slips, I can notify you again. Sound good?',
      },
      { role: 'caller', text: 'Yes — thank you.' },
      { role: 'bot', text: 'Glad I could help. Take care — goodbye.' },
    ];
  }

  // Lead qualify / collect — spoken, valuable middle, not metrics-as-dialogue
  const shorter = /shorter|too long|compress/i.test(correctionHint || '');
  if (shorter) {
    return [
      { role: 'bot', text: `Thanks for calling ${brand}. How can I help today?` },
      {
        role: 'caller',
        text: 'I need someone who can qualify a new project quickly.',
      },
      {
        role: 'bot',
        text: 'Happy to help. Is this urgent, and are you the decision-maker?',
      },
      { role: 'caller', text: `Yes — soon, and I’m the decision-maker, ${first}.` },
      {
        role: 'bot',
        text: 'Got it. What’s the service area or zip so we know you’re in range?',
      },
      { role: 'caller', text: '33609.' },
      {
        role: 'bot',
        text: 'You’re in range. I’ll create the lead and have the team call you back today.',
      },
      { role: 'caller', text: 'Please do.' },
      {
        role: 'bot',
        text: 'Done. You’ll hear from the team shortly. Anything else?',
      },
      { role: 'caller', text: 'That’s all.' },
      { role: 'bot', text: 'Thanks for calling — goodbye.' },
    ];
  }
  return [
    { role: 'bot', text: `Thanks for calling ${brand}. How can I help today?` },
    {
      role: 'caller',
      text: 'Hi — I’m looking into whether you can help with a new project.',
    },
    {
      role: 'bot',
      text: 'Happy to help. Is this something you need soon, or are you still comparing options?',
    },
    { role: 'caller', text: 'Soon — ideally in the next couple of weeks.' },
    {
      role: 'bot',
      text: 'Understood. What would a good next step look like for you — a quote, a callback, or a short consult?',
    },
    { role: 'caller', text: 'A callback from someone who can qualify the fit.' },
    {
      role: 'bot',
      text: 'I can arrange that. Are you the decision-maker, or should we include someone else?',
    },
    { role: 'caller', text: `I’m the decision-maker — ${first}.` },
    {
      role: 'bot',
      text: 'Thanks. Any constraint I should capture so the team is prepared — timeline, location, or budget range?',
    },
    { role: 'caller', text: 'Timeline is the main one — about two weeks.' },
    {
      role: 'bot',
      text: 'Got it. You’re a fit for follow-up. I’ll create the lead and have the team call you back.',
    },
    { role: 'caller', text: 'Please do — appreciate it.' },
    {
      role: 'bot',
      text: 'Done. You’ll hear from the team shortly. Thanks for calling — goodbye.',
    },
  ];
}

function basePrivate(
  complexity: string,
  hours: number,
  rationale: string,
): PrivateQuote {
  return {
    complexity,
    quoteHours: hours,
    baseHours: hours,
    integrationHours: 0,
    integrationKind: 'none',
    rationale,
  };
}

function simpleFlowFor(useCase: string) {
  const faq = /faq|question|inform/i.test(useCase);
  const book = /book|appoint/i.test(useCase);
  if (faq) {
    return [
      { id: 'greeting', label: 'Greeting', kind: 'speak' },
      { id: 'topic', label: 'Topic', kind: 'listen' },
      { id: 'clarify', label: 'Clarify need', kind: 'listen' },
      { id: 'answer', label: 'Answer', kind: 'speak' },
      { id: 'more', label: 'Anything else', kind: 'listen' },
      { id: 'end', label: 'End', kind: 'end' },
      { id: 'unknownTransition', label: 'Unknown', kind: 'portal' },
      { id: 'transferToHuman', label: 'Transfer', kind: 'portal' },
      { id: 'goodbye', label: 'Goodbye', kind: 'portal' },
    ];
  }
  if (book) {
    return [
      { id: 'greeting', label: 'Greeting', kind: 'speak' },
      { id: 'service', label: 'Service', kind: 'listen' },
      { id: 'urgency', label: 'Urgency', kind: 'listen' },
      { id: 'slot', label: 'Offer slot', kind: 'speak' },
      { id: 'confirm', label: 'Confirm', kind: 'listen' },
      { id: 'booked', label: 'Booked', kind: 'speak' },
      { id: 'end', label: 'End', kind: 'end' },
      { id: 'unknownTransition', label: 'Unknown', kind: 'portal' },
      { id: 'transferToHuman', label: 'Transfer', kind: 'portal' },
      { id: 'goodbye', label: 'Goodbye', kind: 'portal' },
    ];
  }
  return [
    { id: 'greeting', label: 'Greeting', kind: 'speak' },
    { id: 'need', label: 'Need', kind: 'listen' },
    { id: 'urgency', label: 'Urgency', kind: 'listen' },
    { id: 'outcome', label: 'Desired outcome', kind: 'listen' },
    { id: 'qualify', label: 'Qualify', kind: 'listen' },
    { id: 'constraints', label: 'Constraints', kind: 'listen' },
    { id: 'decision', label: 'Decision', kind: 'speak' },
    { id: 'end', label: 'End', kind: 'end' },
    { id: 'unknownTransition', label: 'Unknown', kind: 'portal' },
    { id: 'mad', label: 'Mad', kind: 'portal' },
    { id: 'transferToHuman', label: 'Transfer', kind: 'portal' },
    { id: 'goodbye', label: 'Goodbye', kind: 'portal' },
  ];
}

