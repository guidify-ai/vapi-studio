#!/usr/bin/env node
/**
 * Drive N planner conversations against sample-landing-llm (:9998).
 * Usage: node scripts/evals/run-25-convos.mjs [count=25] [baseUrl]
 * Requires OPENAI_API_KEY in the sample process .env (restart after setting).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COUNT = Number(process.argv[2] || 25);
const BASE = (process.argv[3] || 'http://127.0.0.1:9998').replace(/\/$/, '');
/** Optional 4th arg: comma-separated persona ids, e.g. --ids=2,4,25 or 2,4,25 */
const IDS_ARG = (process.argv[4] || '').replace(/^--ids=/, '').trim();
const PERSONA_IDS = IDS_ARG
  ? IDS_ARG.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0)
  : null;
const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(ROOT, 'out');
const MAX_TURNS = 18;

/** @typedef {{ role: 'user'|'assistant', content: string }} Msg */

const PERSONAS = [
  {
    id: 1,
    name: 'Happy path HVAC lead',
    company: 'Westshore Heating',
    email: 'ops@westshore.test',
    contact: 'Dana',
    replies: [
      'Residential HVAC install and repair in the Tampa Bay area.',
      'Qualify inbound leads and book a tech when they sound urgent.',
      'Success is a booked visit or a clean handoff with service type, zip, and urgency.',
      'Must know: heating or cooling, zip code, and whether anything is unsafe now.',
      'Not a fit if outside our service area or they only want DIY advice.',
      'Transfer if they mention gas smell, no heat in freezing weather, or demand a manager.',
      'Professional, calm, slightly southern-friendly — not salesy.',
      'proceed',
      'Salesforce',
      'The sample feels right. Looks good.',
    ],
  },
  {
    id: 2,
    name: 'FAQ-first SaaS',
    company: 'Ledgerly',
    email: 'sam@ledgerly.test',
    contact: 'Sam',
    replies: [
      'We sell bookkeeping software for freelancers.',
      'Answer common support FAQs on the phone so tickets drop.',
      'Callers usually ask about invoices, bank sync, and billing.',
      'If they want a refund or account deletion, transfer to a human.',
      'Tone should sound like a sharp CS agent, not a marketer.',
      'proceed',
      'Zendesk',
      'Make the sample more triage-first — ask what broke before dumping FAQ answers.',
      'Better. Thanks.',
    ],
  },
  {
    id: 3,
    name: 'Booking clinic',
    company: 'Northside Dental',
    email: 'frontdesk@northside.test',
    contact: 'Priya',
    replies: [
      'General dentistry clinic with three chairs.',
      'Book new-patient cleanings and checkups by phone.',
      'Need name, callback number, preferred day, and insurance yes/no.',
      'We close Fridays at 2pm — do not offer Friday late slots.',
      'Transfer if they have tooth pain rated 7+ or swelling.',
      'proceed',
      'Just email notifications for now',
      'ok',
    ],
  },
  {
    id: 4,
    name: 'Angry / impatient guest',
    company: 'QuickFix Plumbing',
    email: 'boss@quickfix.test',
    contact: 'Mike',
    replies: [
      'Emergency plumbing.',
      'Lead qualify. Stop asking me fluff.',
      'I already told you — emergency plumbing leads. Build something.',
      'proceed',
      'HubSpot',
      'This sample is too long. Shorter.',
      'fine',
    ],
  },
  {
    id: 5,
    name: 'Vague explorer',
    company: 'Bright Ideas Co',
    email: 'hello@brightideas.test',
    contact: 'Jordan',
    replies: [
      'We do a bit of everything in marketing.',
      'Not sure — maybe voice AI?',
      'I guess qualify website leads?',
      'Whatever usually works.',
      'proceed',
      'none',
      'looks good',
    ],
  },
  {
    id: 6,
    name: 'Roofer estimate',
    company: 'Peak Roof Pros',
    email: 'chris@peakroof.test',
    contact: 'Chris',
    replies: [
      'Residential roofing — inspections and replacements.',
      'Collect storm-damage leads and schedule an estimate.',
      'Need address, insurance claim yes/no, and how many squares if they know.',
      'Disqualify tire-kickers who refuse an address.',
      'proceed',
      'JobNimbus',
      'Caller sounded robotic. Make them sound like a homeowner after a storm.',
      'yes that works',
    ],
  },
  {
    id: 7,
    name: 'Legal intake',
    company: 'Rivera Injury Law',
    email: 'intake@riveralaw.test',
    contact: 'Elena',
    replies: [
      'Personal injury law firm.',
      'Screen PI callers before a paralegal callback.',
      'Must capture incident date, injury type, and whether they already hired counsel.',
      'Hard disqualify if they already have an attorney.',
      'Tone: empathetic but precise — never promise outcomes.',
      'proceed',
      'Clio',
      'thanks',
    ],
  },
  {
    id: 8,
    name: 'Corrects company midstream',
    company: 'Old Name LLC',
    email: 'pat@newco.test',
    contact: 'Pat',
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA questions.',
      'Success = fewer “where is my package” transfers.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'ok',
    ],
  },
  {
    id: 9,
    name: 'Self-host engineer',
    company: 'Stackwright',
    email: 'dev@stackwright.test',
    contact: 'Riley',
    replies: [
      'Devtools consulting — we ship internal platforms.',
      'I want to self-host Vapi Studio and build a qualify bot myself.',
      'I care about deterministic routing and analytics tags I can query.',
      'Show me a tight lead-qualify sample I can copy.',
      'proceed',
      'none — BYOK',
      'Looks solid. I might still want Guidify for the first module.',
    ],
  },
  {
    id: 10,
    name: 'Multi-location restaurant',
    company: 'Harbor Pizza',
    email: 'gm@harborpizza.test',
    contact: 'Alex',
    replies: [
      'Three pizza restaurants.',
      'Take carryout orders by phone and route by location.',
      'Need location, order items, and pickup time.',
      'Transfer if the caller wants catering over $200.',
      'proceed',
      'Toast',
      'good',
    ],
  },
  {
    id: 11,
    name: 'Healthcare scheduling',
    company: 'Summit Physio',
    email: 'care@summitphysio.test',
    contact: 'Nora',
    replies: [
      'Outpatient physiotherapy clinic.',
      'Reschedule and new-patient booking.',
      'HIPAA-ish care: do not dig into diagnosis on the phone.',
      'Collect DOB only after confirming they are the patient.',
      'proceed',
      'Jane App',
      'Remove clinical detail from the sample — keep it scheduling-only.',
      'perfect',
    ],
  },
  {
    id: 12,
    name: 'Spammy one-liners',
    company: 'X',
    email: 'x@x.test',
    contact: 'X',
    replies: [
      'stuff',
      'leads',
      'idk',
      'proceed',
      'n/a',
      'ok',
    ],
  },
  {
    id: 13,
    name: 'Insurance claims',
    company: 'ClearClaim Adjusters',
    email: 'desk@clearclaim.test',
    contact: 'Morgan',
    replies: [
      'Independent insurance adjusters.',
      'Triage FNOL calls and schedule an inspection.',
      'Need policy number if they have it, loss type, and preferred window.',
      'Escalate if total loss or attorney mentioned.',
      'proceed',
      'Salesforce + custom portal',
      'looks good',
    ],
  },
  {
    id: 14,
    name: 'Real estate showing',
    company: 'Cobalt Realty',
    email: 'agent@cobalt.test',
    contact: 'Taylor',
    replies: [
      'Residential real estate brokerage.',
      'Qualify buyer leads and book property showings.',
      'Budget range, pre-approval yes/no, neighborhoods, and timeline.',
      'Disqualify investors who refuse a budget.',
      'proceed',
      'Follow Up Boss',
      'ok',
    ],
  },
  {
    id: 15,
    name: 'Pushes discovery early exit',
    company: 'Metro Solar',
    email: 'sales@metrosolar.test',
    contact: 'Kim',
    replies: [
      'Home solar sales and installs.',
      'Qualify owners for a free assessment.',
      'I already know what I need — proceed to the design.',
      'HubSpot',
      'Ship it.',
    ],
  },
  {
    id: 16,
    name: 'CSAT / metrics obsessed',
    company: 'Nimbus Support',
    email: 'vp@nimbus.test',
    contact: 'Vic',
    replies: [
      'B2B SaaS customer success.',
      'Deflect tier-1 calls and track CSAT plus containment rate.',
      'Success criteria: CSAT > 4.5, containment 60%, AHT under 3 minutes.',
      'Must resolve password reset and invoice copy without a human.',
      'proceed',
      'Intercom',
      'Do NOT put CSAT numbers in the spoken sample. Keep dialogue natural.',
      'yes',
    ],
  },
  {
    id: 17,
    name: 'Nonprofit donations',
    company: 'Harbor Wildlife Fund',
    email: 'dev@harborwildlife.test',
    contact: 'Lee',
    replies: [
      'Wildlife conservation nonprofit.',
      'Take donation pledges by phone and send a receipt link.',
      'Need donor name, amount, and email for receipt.',
      'Never pressure — soft ask once.',
      'proceed',
      'Salesforce NPSP',
      'thanks',
    ],
  },
  {
    id: 18,
    name: 'Auto dealership',
    company: 'Lakeview Motors',
    email: 'sales@lakeviewmotors.test',
    contact: 'Drew',
    replies: [
      'New and used car dealership.',
      'Book test drives and capture trade-in interest.',
      'Need model interest, preferred day, and whether they have a trade.',
      'Transfer to desk if they ask for monthly payment quotes.',
      'proceed',
      'DealerSocket',
      'ok',
    ],
  },
  {
    id: 19,
    name: 'Non-English mix',
    company: 'Casa Bella Realty',
    email: 'maria@casabella.test',
    contact: 'Maria',
    replies: [
      'Bilingual real estate — English and Spanish clients.',
      'Qualify rental inquiries; answer in the caller’s language.',
      'Need move-in date, budget, and pets yes/no.',
      'If Spanish, stay in Spanish for the whole call.',
      'proceed',
      'AppFolio',
      'Sample should include one Spanish turn pair.',
      'bien',
    ],
  },
  {
    id: 20,
    name: 'Security-conscious',
    company: 'VaultPay',
    email: 'sec@vaultpay.test',
    contact: 'Avery',
    replies: [
      'Payment infrastructure for marketplaces.',
      'Status-check bot for merchant onboarding — no card data.',
      'Never collect PAN or CVV. Identity = merchant ID + email domain match.',
      'Transfer on disputes or chargeback threats.',
      'proceed',
      'custom',
      'Confirm the sample never asks for card numbers.',
      'good',
    ],
  },
  {
    id: 21,
    name: 'Hotel reservations',
    company: 'Cedar Inn',
    email: 'front@cedarinn.test',
    contact: 'Harper',
    replies: [
      'Boutique hotel, 42 rooms.',
      'Take reservation requests and check availability windows.',
      'Need dates, guests, and smoking preference.',
      'Transfer if group booking over 5 rooms.',
      'proceed',
      'Cloudbeds',
      'ok',
    ],
  },
  {
    id: 22,
    name: 'Edu admissions',
    company: 'Northridge Coding Bootcamp',
    email: 'admissions@northridge.test',
    contact: 'Casey',
    replies: [
      'Full-stack coding bootcamp.',
      'Qualify applicants and book an admissions call.',
      'Need background, funding plan, and start-date preference.',
      'Disqualify if under 18.',
      'proceed',
      'HubSpot',
      'looks good',
    ],
  },
  {
    id: 23,
    name: 'Many corrections',
    company: 'GreenLeaf Landscaping',
    email: 'owen@greenleaf.test',
    contact: 'Owen',
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address, lot size if known, and preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf not company.',
      'Caller should mention overgrown backyard.',
      'Add a still-there style pause recovery in the sample somehow.',
      'Shorter closing.',
      'Make bot less chatty.',
      'ok enough',
    ],
  },
  {
    id: 24,
    name: 'Hire Guidify explicit',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Must transfer hot loads to a broker immediately.',
      'proceed',
      'McLeod',
      'Please have Guidify build this. Help me build it.',
    ],
  },
  {
    id: 25,
    name: 'Off-topic then recover',
    company: 'Pinecrest Vet',
    email: 'hello@pinecrestvet.test',
    contact: 'Jamie',
    replies: [
      'Veterinary clinic for dogs and cats.',
      'What is the weather today?',
      'Sorry — booking sick visits and vaccine appointments.',
      'Need pet name, species, and urgency.',
      'Transfer if breathing trouble or toxin ingestion.',
      'proceed',
      'DaySmart Vet',
      'ok',
    ],
  },
];

const ISSUE_PATTERNS = [
  { id: 'gush', re: /\b(love it|awesome|perfect!|nice!|amazing)\b/i },
  { id: 'cap_leak', re: /\b(up to\s*\d+|limit|cap|max(imum)?\s*\d+\s*(questions|corrections|turns))\b/i },
  { id: 'hours_leak', re: /\b(\d+\s*hours?|quoteHours|complexity\s*[SMLX]|\$\d+)\b/i },
  { id: 'jargon_open', re: /^(deterministic|BYOK|self-host|vertical)/i },
  { id: 'reask_identity', re: /\b(what('?s| is) your (name|email|company)|company name)\b/i },
  { id: 'hot_lead_leak', re: /\bhot\s*lead\b/i },
  { id: 'csat_in_speech', re: /\b(CSAT|containment rate|AHT)\b/i },
];

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

function analyze(transcript, draft) {
  const issues = [];
  for (const m of transcript.filter((t) => t.role === 'assistant')) {
    for (const p of ISSUE_PATTERNS) {
      if (p.re.test(m.content)) issues.push({ id: p.id, excerpt: m.content.slice(0, 120) });
    }
  }
  const sample = draft?.sampleConversation || [];
  if (!sample.length) {
    issues.push({ id: 'sample_missing', excerpt: 'no sampleConversation' });
  } else {
    const joined = sample.map((l) => l.text || '').join(' ');
    if (/CSAT|containment|funnel|discoveryAnswers/i.test(joined)) {
      issues.push({ id: 'sample_jargon', excerpt: joined.slice(0, 140) });
    }
    if (sample.length < 10) issues.push({ id: 'sample_thin', excerpt: `lines=${sample.length}` });
    const callerBits = sample.filter((l) => l.role === 'caller').map((l) => l.text || '');
    if (callerBits.some((t) => t.length > 180 && /;|,.*,.*,/.test(t))) {
      issues.push({ id: 'sample_concat', excerpt: callerBits.find((t) => t.length > 180)?.slice(0, 140) });
    }
  }
  if (!draft?.discoveryComplete && (draft?.discoveryAnswers || []).length >= 7) {
    issues.push({ id: 'discovery_stuck' });
  }
  return issues;
}

function nextReply(persona, draft, assistantMessage, replyIdx) {
  // If planner asks to proceed / ready, prefer early exit when persona has it queued later
  const msg = (assistantMessage || '').toLowerCase();
  if (replyIdx >= persona.replies.length) {
    if (/help me build|guidify|looks good|change/i.test(msg)) return 'looks good';
    if (/integrat|crm|tool/i.test(msg)) return 'none';
    if (/sample|\[\[sample_call\]\]/i.test(msg)) return 'looks good';
    return 'proceed';
  }
  return persona.replies[replyIdx];
}

async function runOne(persona) {
  const sessionId = randomUUID();
  /** @type {Msg[]} */
  const transcript = [];
  const events = [];
  let draft = null;
  let messages = [];

  const intake = await post('/api/design/intake', {
    sessionId,
    companyName: persona.company,
    contactEmail: persona.email,
    contactName: persona.contact,
  });
  draft = intake.draft;
  messages = intake.messages || [];
  transcript.push({ role: 'assistant', content: intake.assistantMessage || '' });
  events.push({ type: 'intake', assistant: intake.assistantMessage, draft });

  let replyIdx = 0;
  let turns = 0;
  let lastSample = '';

  while (turns < MAX_TURNS) {
    const userText = nextReply(persona, draft, transcript.at(-1)?.content || '', replyIdx);
    replyIdx += 1;
    turns += 1;
    transcript.push({ role: 'user', content: userText });

    const turn = await post('/api/design/turn', {
      sessionId,
      message: userText,
      messages,
      draft,
    });
    draft = turn.draft;
    messages = turn.messages || messages;
    const a = turn.assistantMessage || '';
    transcript.push({ role: 'assistant', content: a });
    events.push({ type: 'turn', user: userText, assistant: a, draftSnapshot: summarizeDraft(draft) });

    const sampleLen = (draft?.sampleConversation || []).length;
    const sampleKey = JSON.stringify(draft?.sampleConversation || []);
    const affirmed = /looks good|thanks|fine|ok|ship|help me build|perfect|bien|good/i.test(
      userText,
    );
    const done =
      (draft?.offerHelp && sampleLen >= 10 && affirmed) ||
      (sampleLen >= 10 && sampleKey === lastSample && affirmed) ||
      turns >= MAX_TURNS;
    lastSample = sampleKey;
    if (done) break;
    // Soft stop if help offered WITH a rich sample and guest already affirmed
    if (
      draft?.offerHelp &&
      sampleLen >= 10 &&
      /help me build it|guidify/i.test(a) &&
      replyIdx >= persona.replies.length
    ) {
      break;
    }
  }

  const issues = analyze(transcript, draft);
  return {
    id: persona.id,
    name: persona.name,
    sessionId,
    turns,
    issues,
    draft: summarizeDraft(draft),
    transcript,
    events,
  };
}

function summarizeDraft(d) {
  if (!d) return null;
  return {
    companyName: d.companyName,
    companyDoes: d.companyDoes,
    useCase: d.useCase,
    discoveryAnswers: d.discoveryAnswers?.length || 0,
    discoveryComplete: d.discoveryComplete,
    funnels: (d.funnels || []).map((f) => f.label || f.id),
    analyticsEvents: (d.analyticsEvents || []).length,
    flowNodes: (d.flowNodes || []).length,
    sampleLines: (d.sampleConversation || []).length,
    samplePreview: (d.sampleConversation || []).slice(0, 4),
    integrationInterest: d.integrationInterest,
    offerHelp: d.offerHelp,
    correctionCount: d.correctionCount,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!PERSONAS.length) throw new Error('PERSONAS empty');
  const roster = PERSONA_IDS?.length
    ? PERSONA_IDS.map((id) => {
        const p = PERSONAS.find((x) => x.id === id);
        if (!p) throw new Error(`Unknown persona id ${id}`);
        return p;
      })
    : PERSONAS;
  /** Cycle roster when COUNT > roster size. */
  const schedule = Array.from({ length: COUNT }, (_, i) => {
    const p = roster[i % roster.length];
    return { ...p, runIndex: i + 1 };
  });
  const results = [];
  console.log(
    `Running ${schedule.length} conversations against ${BASE} (${PERSONAS.length} persona templates)`,
  );

  for (const p of schedule) {
    process.stdout.write(`#${p.runIndex}/${COUNT} ${p.name} ... `);
    try {
      const r = await runOne(p);
      results.push({ ...r, runIndex: p.runIndex });
      const issueIds = [...new Set(r.issues.map((i) => i.id))].join(',') || 'none';
      console.log(`ok turns=${r.turns} sample=${r.draft?.sampleLines || 0} issues=${issueIds}`);
    } catch (err) {
      console.log('FAIL', err.message || err);
      results.push({
        id: p.id,
        runIndex: p.runIndex,
        name: p.name,
        error: String(err.message || err),
        issues: [{ id: 'error' }],
        transcript: [],
      });
    }
  }

  const issueCounts = {};
  for (const r of results) {
    for (const i of r.issues || []) {
      issueCounts[i.id] = (issueCounts[i.id] || 0) + 1;
    }
  }

  const summary = {
    ranAt: new Date().toISOString(),
    base: BASE,
    count: results.length,
    issueCounts,
    sessions: results.map((r) => ({
      id: r.id,
      name: r.name,
      sessionId: r.sessionId,
      turns: r.turns,
      error: r.error,
      issues: r.issues,
      draft: r.draft,
    })),
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryPath = join(OUT_DIR, `summary-${stamp}.json`);
  const fullPath = join(OUT_DIR, `full-${stamp}.json`);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  writeFileSync(fullPath, JSON.stringify(results, null, 2));
  console.log('\nWrote', summaryPath);
  console.log('Issue tallies:', issueCounts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
