/**
 * Planner knowledge base — transferred from the Nest LP planner eval findings.
 * Matched server-side before treating a turn as a plan correction or unknown.
 */

export type KnowledgeEntry = {
  id: string;
  keywords: string[];
  answer: string;
};

export const PLANNER_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'what-is-vapi-studio',
    keywords: [
      'what is vapi studio',
      'what does vapi studio',
      'explain vapi studio',
      'how does this work',
      'what is this',
    ],
    answer:
      'Vapi Studio is an open-source toolkit for building deterministic voice agents on Vapi — the call path is a graph you control; the LLM is only used at listen boundaries. Guidify is the only official team.',
  },
  {
    id: 'deterministic',
    keywords: [
      'deterministic',
      'graph owns',
      'not free-form',
      'controllable',
      'supervisor',
    ],
    answer:
      'Deterministic agents mean the conversation graph owns the call. The model only helps at listen points you declare — so paths stay predictable and testable.',
  },
  {
    id: 'self-host-byok',
    keywords: [
      'self-host',
      'self host',
      'byok',
      'bring your own',
      'own keys',
      'api keys',
      'open source',
      'docker',
    ],
    answer:
      'Yes — Vapi Studio is free to self-host with BYOK (your OpenAI/Claude/Gemini/Grok, Vapi, Twilio, CRM). You run it in Docker; Guidify can still help build the first module if you want.',
  },
  {
    id: 'pricing-hours',
    keywords: [
      'how much',
      'pricing',
      'price',
      'cost',
      'hours',
      'quote',
      'rate',
      'expensive',
    ],
    answer:
      "We don't quote hours or price in this chat. Use Help me build it and Guidify will follow up with a scoped quote — often unexpectedly low for common setups.",
  },
  {
    id: 'guidify-team',
    keywords: [
      'guidify',
      'official team',
      'who builds',
      'hire you',
      'your team',
      'management',
      'analytics team',
    ],
    answer:
      'Guidify is the only official Vapi Studio team. You can build yourself, or hire us for full-cycle work — Management, Development, and Analytics. Help me build it attaches your draft for follow-up.',
  },
  {
    id: 'vapi-required',
    keywords: [
      'need vapi',
      'without vapi',
      'only chat',
      'web chat',
      'text chat',
      'not voice',
    ],
    answer:
      'Vapi is the voice channel; the same Studio conversation framework can also power web chat. This landing planner is itself a chat sample of that idea.',
  },
  {
    id: 'integrations',
    keywords: [
      'crm',
      'hubspot',
      'salesforce',
      'zendesk',
      'intercom',
      'integrate',
      'integration',
      'webhook',
    ],
    answer:
      "Common CRMs and tools plug in without a private integration surcharge; custom/internal APIs are scoped separately. Tell me which system you use and we'll note it on the draft.",
  },
  {
    id: 'portals',
    keywords: [
      'portal',
      'mad',
      'unknown',
      'still there',
      'transfer',
      'goodbye',
      'transfer to human',
    ],
    answer:
      'Standard portals cover mad callers, unknown replies, still-there silence, goodbye, and transfer-to-human — so every agent stays finite and recoverable.',
  },
  {
    id: 'analytics',
    keywords: [
      'analytics',
      'funnel',
      'events',
      'tags',
      'csat',
      'containment',
      'measure',
    ],
    answer:
      'You define funnels and event tags in code for the outcomes you care about. Spoken sample dialogue stays free of metric jargon — tracking lives in the draft and runtime events.',
  },
  {
    id: 'sample-call',
    keywords: [
      'sample call',
      'sample conversation',
      'preview call',
      'demo call',
      'show me a sample',
    ],
    answer:
      "The sample call is a spoken-style preview of the agent we're designing for you — not production audio. Ask for changes anytime after it appears, or use Help me build it to have Guidify implement it.",
  },
  {
    id: 'security-pii',
    keywords: [
      'hipaa',
      'pci',
      'card number',
      'ssn',
      'privacy',
      'gdpr',
      'secure',
    ],
    answer:
      "Design the agent so it never collects sensitive data you don't need. For regulated workloads, Guidify will scope controls with you — use Help me build it and we'll follow up on compliance details.",
  },
];

export type KnowledgeMatch = {
  id: string;
  answer: string;
  score: number;
};

/** Best KB hit, or null if nothing clear enough. */
export function matchKnowledge(
  userText: string,
  minScore = 2,
): KnowledgeMatch | null {
  const t = userText.trim().toLowerCase();
  if (t.length < 4) return null;
  let best: KnowledgeMatch | null = null;
  for (const entry of PLANNER_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (t.includes(kw)) score += kw.split(/\s+/).length >= 2 || kw.includes('-') ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { id: entry.id, answer: entry.answer, score };
    }
  }
  return best && best.score >= minScore ? best : null;
}

/** Product / process question rather than a design correction or discovery answer. */
export function looksLikeKnowledgeQuestion(userText: string): boolean {
  const t = userText.trim();
  if (!t || t.length < 8) return false;
  if (
    /^(make |change |shorter|longer|rewrite|fix |update the sample|caller should|bot should)/i.test(
      t,
    )
  ) {
    return false;
  }
  if (
    /\b(what is|how (does|do|much)|can i|do you|is it|pricing|self-?host|open source|byok|guidify|vapi studio|hipaa|crm)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  return matchKnowledge(t) !== null;
}
