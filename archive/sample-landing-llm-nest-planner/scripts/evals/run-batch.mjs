#!/usr/bin/env node
/**
 * Run a targeted batch of planner personas (default: next-5 stress set).
 * Usage: node scripts/evals/run-batch.mjs [batchId=1] [baseUrl]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BATCH = Number(process.argv[2] || 1);
const BASE = (process.argv[3] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(ROOT, 'out');
const MAX_TURNS = 14;

const BATCHES = {
  1: null, // filled below
};

/** Batch 1–3 stress set (5). */
const STRESS5 = [
  {
    id: 1,
    name: 'Impatient plumber',
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
    id: 2,
    name: 'Midstream rebrand',
    company: 'Old Name LLC',
    email: 'pat@newco.test',
    contact: 'Pat',
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA questions.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'looks good',
    ],
  },
  {
    id: 3,
    name: 'Hire Guidify explicit',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Must transfer hot loads to a broker immediately.',
      'Help me build it — please have Guidify build this.',
    ],
  },
  {
    id: 4,
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
  {
    id: 5,
    name: 'CSAT metrics guest',
    company: 'Nimbus Support',
    email: 'vp@nimbus.test',
    contact: 'Vic',
    replies: [
      'B2B SaaS customer success.',
      'Deflect tier-1 calls and track CSAT plus containment rate.',
      'Must resolve password reset and invoice copy without a human.',
      'proceed',
      'Intercom',
      'Do NOT put CSAT numbers in the spoken sample.',
      'yes',
    ],
  },
];

BATCHES[1] = STRESS5;
BATCHES[2] = STRESS5;
BATCHES[3] = STRESS5;

/** Next 10 — polish plan personas. */
BATCHES[4] = [
  {
    id: 1,
    name: 'Impatient compress',
    company: 'QuickFix Plumbing',
    email: 'boss@quickfix.test',
    contact: 'Mike',
    expect: { sampleByTurn: 4, openQuestion: true },
    replies: [
      'Emergency plumbing.',
      'Lead qualify. Stop fluff — build something.',
      'proceed',
      'HubSpot',
      'Shorter sample.',
      'nothing else',
    ],
  },
  {
    id: 2,
    name: 'FAQ + correction',
    company: 'Ledgerly',
    email: 'sam@ledgerly.test',
    contact: 'Sam',
    expect: { correctionRewrites: true },
    replies: [
      'Bookkeeping software for freelancers.',
      'Answer common support FAQs on the phone so tickets drop.',
      'Must know account email; transfer refunds.',
      'proceed',
      'Zendesk',
      'Make the sample triage-first — ask what broke before FAQ answers.',
      'Better. Nothing else.',
    ],
  },
  {
    id: 3,
    name: 'Hire Guidify',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    expect: { offerHelp: true, sampleShown: true },
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Transfer hot loads immediately.',
      'Help me build it.',
      'nothing else',
    ],
  },
  {
    id: 4,
    name: 'Midstream rebrand',
    company: 'Old Name LLC',
    email: 'pat@newco.test',
    contact: 'Pat',
    expect: { company: 'NewCo Logistics', sampleShown: true },
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'looks good',
      'no',
    ],
  },
  {
    id: 5,
    name: 'Off-topic recover',
    company: 'Pinecrest Vet',
    email: 'hello@pinecrestvet.test',
    contact: 'Jamie',
    expect: { weatherRedirect: true, companyStays: 'Pinecrest Vet' },
    replies: [
      'Veterinary clinic for dogs and cats.',
      'What is the weather today?',
      'Booking sick visits and vaccine appointments.',
      'Need pet name, species, and urgency.',
      'Transfer if breathing trouble or toxin ingestion.',
      'proceed',
      'DaySmart Vet',
      'nothing else',
    ],
  },
  {
    id: 6,
    name: 'CSAT metrics',
    company: 'Nimbus Support',
    email: 'vp@nimbus.test',
    contact: 'Vic',
    expect: { noCsatSpeech: true },
    replies: [
      'B2B SaaS customer success.',
      'Deflect tier-1 calls and track CSAT plus containment rate.',
      'Must resolve password reset and invoice copy without a human.',
      'proceed',
      'Intercom',
      'Do NOT put CSAT numbers in the spoken sample.',
      'yes',
      'nothing else',
    ],
  },
  {
    id: 7,
    name: 'Vague explorer',
    company: 'Bright Ideas Co',
    email: 'hello@brightideas.test',
    contact: 'Jordan',
    expect: { sampleShown: true },
    replies: [
      'We do a bit of everything in marketing.',
      'Not sure — maybe voice AI?',
      'I guess qualify website leads?',
      'Whatever usually works.',
      'proceed',
      'none',
      'looks good',
      'nothing else',
    ],
  },
  {
    id: 8,
    name: 'Early proceed',
    company: 'Metro Solar',
    email: 'sales@metrosolar.test',
    contact: 'Kim',
    expect: { sampleByTurn: 5 },
    replies: [
      'Home solar sales and installs.',
      'Qualify owners for a free assessment.',
      'Need homeowner status and utility bill range.',
      'proceed',
      'HubSpot',
      'looks good',
      'nothing else',
    ],
  },
  {
    id: 9,
    name: 'Many corrections',
    company: 'GreenLeaf Landscaping',
    email: 'owen@greenleaf.test',
    contact: 'Owen',
    expect: { corrections: 2 },
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address, lot size if known, preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'Shorter closing.',
      'nothing else',
    ],
  },
  {
    id: 10,
    name: 'Happy-path HVAC + KB',
    company: 'Westshore Heating',
    email: 'ops@westshore.test',
    contact: 'Dana',
    expect: { kbAnswer: true, openQuestion: true },
    replies: [
      'Residential HVAC install and repair in the Tampa Bay area.',
      'Qualify inbound leads and book a tech when urgent.',
      'Must know heating or cooling, zip, and unsafe conditions.',
      'Transfer on gas smell or no heat in freezing weather.',
      'proceed',
      'Salesforce',
      'How much does Guidify pricing cost?',
      'Can you support on-prem SAP with custom SSO next week?',
      'nothing else',
    ],
  },
];

/** Finish remaining personas after rate-limit interrupt. */
BATCHES[41] = BATCHES[4].slice(7);

/**
 * Batch 5 — next 10 narrow polish checks (learning from batch 4/41).
 * Targets: quiet CRM, sticky decline, hire speed, vague default,
 * proven corrections, one-question discovery, KB/unanswered, no CRM rename.
 */
BATCHES[5] = [
  {
    id: 1,
    name: 'Quiet HubSpot after accelerate',
    company: 'Metro Solar',
    email: 'sales@metrosolar.test',
    contact: 'Kim',
    replies: [
      'Home solar sales and installs.',
      'Qualify owners for a free assessment.',
      'Need homeowner status and utility bill range.',
      'proceed',
      'HubSpot',
      'nothing else',
    ],
  },
  {
    id: 2,
    name: 'Sticky decline after Better. Nothing else.',
    company: 'Ledgerly',
    email: 'sam@ledgerly.test',
    contact: 'Sam',
    replies: [
      'Bookkeeping software for freelancers.',
      'Answer common support FAQs on the phone so tickets drop.',
      'Must know account email; transfer refunds.',
      'proceed',
      'Zendesk',
      'Make the sample triage-first — ask what broke before FAQ answers.',
      'Better. Nothing else.',
      'looks good',
    ],
  },
  {
    id: 3,
    name: 'Hire Guidify fast sample',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Help me build it.',
      'nothing else',
    ],
  },
  {
    id: 4,
    name: 'Vague explorer default',
    company: 'Bright Ideas Co',
    email: 'hello@brightideas.test',
    contact: 'Jordan',
    replies: [
      'We do a bit of everything in marketing.',
      'Not sure — maybe voice AI?',
      'Whatever usually works.',
      'proceed',
      'none',
      'nothing else',
    ],
  },
  {
    id: 5,
    name: 'Correction proves GreenLeaf + backyard',
    company: 'GreenLeaf Landscaping',
    email: 'owen@greenleaf.test',
    contact: 'Owen',
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address, lot size if known, preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'Shorter closing.',
      'nothing else',
    ],
  },
  {
    id: 6,
    name: 'Impatient sample-by-turn',
    company: 'QuickFix Plumbing',
    email: 'boss@quickfix.test',
    contact: 'Mike',
    replies: [
      'Emergency plumbing.',
      'Lead qualify. Stop fluff — build something.',
      'proceed',
      'HubSpot',
      'Shorter sample.',
      'nothing else',
    ],
  },
  {
    id: 7,
    name: 'CRM never spoken as rename',
    company: 'Pinecrest Vet',
    email: 'hello@pinecrestvet.test',
    contact: 'Jamie',
    replies: [
      'Veterinary clinic for dogs and cats.',
      'Booking sick visits and vaccine appointments.',
      'Need pet name, species, and urgency.',
      'proceed',
      'DaySmart Vet',
      'nothing else',
    ],
  },
  {
    id: 8,
    name: 'KB + unanswered happy path',
    company: 'Westshore Heating',
    email: 'ops@westshore.test',
    contact: 'Dana',
    replies: [
      'Residential HVAC install and repair in the Tampa Bay area.',
      'Qualify inbound leads and book a tech when urgent.',
      'Must know heating or cooling, zip, and unsafe conditions.',
      'Transfer on gas smell or no heat in freezing weather.',
      'proceed',
      'Salesforce',
      'How much does Guidify pricing cost?',
      'Can you support on-prem SAP with custom SSO next week?',
      'nothing else',
    ],
  },
  {
    id: 9,
    name: 'Discovery one question only',
    company: 'Harbor Dental',
    email: 'front@harbordental.test',
    contact: 'Nina',
    replies: [
      'Family dental practice.',
      'Book new-patient exams and emergencies.',
      'Must know pain level and insurance carrier.',
      'Transfer for swelling or uncontrolled bleeding.',
      'proceed',
      'none',
      'nothing else',
    ],
  },
  {
    id: 10,
    name: 'Rebrand + custom API quiet',
    company: 'Old Name LLC',
    email: 'pat@newco.test',
    contact: 'Pat',
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'looks good',
      'no',
    ],
  },
];


/**
 * Batch 6 — 15 iterations (polish from batch 5 leftovers).
 */
BATCHES[6] = [
  {
    id: 1,
    name: 'No discovery limbo',
    company: 'Westshore Heating',
    email: 'ops@westshore.test',
    contact: 'Dana',
    replies: [
      'Residential HVAC install and repair in the Tampa Bay area.',
      'Qualify inbound leads and book a tech when urgent.',
      'Must know heating or cooling, zip, and unsafe conditions.',
      'Transfer on gas smell or no heat in freezing weather.',
      'Salesforce',
      'nothing else',
    ],
  },
  {
    id: 2,
    name: 'Hire use-case hygiene',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Help me build it.',
      'none',
      'nothing else',
    ],
  },
  {
    id: 3,
    name: 'Dispatch sample template',
    company: 'NewCo Logistics',
    email: 'pat@newco.test',
    contact: 'Pat',
    replies: [
      'Last-mile delivery and dispatch.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'nothing else',
    ],
  },
  {
    id: 4,
    name: 'Brand token GreenLeaf',
    company: 'GreenLeaf Landscaping',
    email: 'owen@greenleaf.test',
    contact: 'Owen',
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address and preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'nothing else',
    ],
  },
  {
    id: 5,
    name: 'Impatient + CRM after sample',
    company: 'QuickFix Plumbing',
    email: 'boss@quickfix.test',
    contact: 'Mike',
    replies: [
      'Emergency plumbing.',
      'Lead qualify. Stop fluff — build something.',
      'proceed',
      'HubSpot',
      'Shorter sample.',
      'nothing else',
    ],
  },
  {
    id: 6,
    name: 'Vague default + no early sample',
    company: 'Bright Ideas Co',
    email: 'hello@brightideas.test',
    contact: 'Jordan',
    replies: [
      'We do a bit of everything in marketing.',
      'Not sure — maybe voice AI?',
      'Whatever usually works.',
      'proceed',
      'none',
      'nothing else',
    ],
  },
  {
    id: 7,
    name: 'Sticky decline + triage',
    company: 'Ledgerly',
    email: 'sam@ledgerly.test',
    contact: 'Sam',
    replies: [
      'Bookkeeping software for freelancers.',
      'Answer common support FAQs on the phone so tickets drop.',
      'Must know account email; transfer refunds.',
      'proceed',
      'Zendesk',
      'Make the sample triage-first — ask what broke before FAQ answers.',
      'Better. Nothing else.',
      'looks good',
    ],
  },
  {
    id: 8,
    name: 'CRM never rename',
    company: 'Pinecrest Vet',
    email: 'hello@pinecrestvet.test',
    contact: 'Jamie',
    replies: [
      'Veterinary clinic for dogs and cats.',
      'Booking sick visits and vaccine appointments.',
      'Need pet name, species, and urgency.',
      'proceed',
      'DaySmart Vet',
      'nothing else',
    ],
  },
  {
    id: 9,
    name: 'KB + unanswered',
    company: 'Harbor Dental',
    email: 'front@harbordental.test',
    contact: 'Nina',
    replies: [
      'Family dental practice.',
      'Book new-patient exams and emergencies.',
      'Must know pain level and insurance carrier.',
      'proceed',
      'none',
      'How much does Guidify pricing cost?',
      'Can you support on-prem SAP with custom SSO next week?',
      'nothing else',
    ],
  },
  {
    id: 10,
    name: 'Off-topic recover',
    company: 'Nimbus Support',
    email: 'vp@nimbus.test',
    contact: 'Vic',
    replies: [
      'B2B SaaS customer success.',
      'What is the weather today?',
      'Deflect tier-1 calls without CSAT jargon in spoken lines.',
      'Must resolve password reset and invoice copy.',
      'proceed',
      'Intercom',
      'Do NOT put CSAT numbers in the spoken sample.',
      'nothing else',
    ],
  },
  {
    id: 11,
    name: 'Midstream rebrand',
    company: 'Old Name LLC',
    email: 'pat@rebrand.test',
    contact: 'Pat',
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'none',
      'looks good',
      'no',
    ],
  },
  {
    id: 12,
    name: 'Solar early proceed',
    company: 'Metro Solar',
    email: 'sales@metrosolar.test',
    contact: 'Kim',
    replies: [
      'Home solar sales and installs.',
      'Qualify owners for a free assessment.',
      'Need homeowner status and utility bill range.',
      'proceed',
      'HubSpot',
      'nothing else',
    ],
  },
  {
    id: 13,
    name: 'One discovery question',
    company: 'Cedar Roofing',
    email: 'ops@cedarroof.test',
    contact: 'Alex',
    replies: [
      'Residential roofing repairs and replacements.',
      'Qualify storm-damage leads and book inspections.',
      'Must know zip, insurance claim status, and roof age if known.',
      'Transfer if active leak into living space.',
      'proceed',
      'JobNimbus',
      'nothing else',
    ],
  },
  {
    id: 14,
    name: 'Correction shorter closing',
    company: 'Toast Cafe Group',
    email: 'ops@toastcafe.test',
    contact: 'Riley',
    replies: [
      'Multi-location cafe catering.',
      'Book catering quotes from inbound calls.',
      'Need headcount, date, and dietary notes.',
      'proceed',
      'Toast',
      'Shorter closing.',
      'nothing else',
    ],
  },
  {
    id: 15,
    name: 'Hire after one must-know',
    company: 'FleetCare Mobile',
    email: 'ceo@fleetcare.test',
    contact: 'Morgan',
    replies: [
      'Mobile fleet maintenance for delivery vans.',
      'We want Guidify to build a booking agent for roadside repairs.',
      'Need vehicle type, location, and urgency.',
      'Help me build it — please have Guidify build this.',
      'none',
      'nothing else',
    ],
  },
];

/**
 * Batch 7 — Iteration 1 chat-trust invariants (I1–I5).
 */
BATCHES[7] = [
  {
    id: 1,
    name: 'I1 Salesforce mid-discovery',
    company: 'Westshore Heating',
    email: 'ops@westshore.test',
    contact: 'Dana',
    expect: { invariants: ['I1', 'I2'] },
    replies: [
      'Residential HVAC install and repair in the Tampa Bay area.',
      'Qualify inbound leads and book a tech when urgent.',
      'Must know heating or cooling, zip, and unsafe conditions.',
      'Transfer on gas smell or no heat in freezing weather.',
      'Salesforce',
      'nothing else',
    ],
  },
  {
    id: 2,
    name: 'I4 Hire then CRM',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    expect: { invariants: ['I2', 'I4'] },
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Help me build it.',
      'none',
      'nothing else',
    ],
  },
  {
    id: 3,
    name: 'I3 GreenLeaf brand stick',
    company: 'GreenLeaf Landscaping',
    email: 'owen@greenleaf.test',
    contact: 'Owen',
    expect: { invariants: ['I3', 'I5'], brandToken: 'GreenLeaf' },
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address and preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'nothing else',
      'looks good',
    ],
  },
  {
    id: 4,
    name: 'I5 Sticky decline Better. Nothing else.',
    company: 'Ledgerly',
    email: 'sam@ledgerly.test',
    contact: 'Sam',
    expect: { invariants: ['I5'] },
    replies: [
      'Bookkeeping software for freelancers.',
      'Answer common support FAQs on the phone so tickets drop.',
      'Must know account email; transfer refunds.',
      'proceed',
      'Zendesk',
      'Make the sample triage-first — ask what broke before FAQ answers.',
      'Better. Nothing else.',
      'looks good',
    ],
  },
  {
    id: 5,
    name: 'I2 Sample marker HubSpot',
    company: 'Metro Solar',
    email: 'sales@metrosolar.test',
    contact: 'Kim',
    expect: { invariants: ['I1', 'I2'] },
    replies: [
      'Home solar sales and installs.',
      'Qualify owners for a free assessment.',
      'Need homeowner status and utility bill range.',
      'proceed',
      'HubSpot',
      'nothing else',
    ],
  },
  {
    id: 6,
    name: 'I4 Hire roadside + CRM',
    company: 'FleetCare Mobile',
    email: 'ceo@fleetcare.test',
    contact: 'Morgan',
    expect: { invariants: ['I2', 'I4'] },
    replies: [
      'Mobile fleet maintenance for delivery vans.',
      'We want Guidify to build a booking agent for roadside repairs.',
      'Need vehicle type, location, and urgency.',
      'Help me build it — please have Guidify build this.',
      'none',
      'nothing else',
    ],
  },
  {
    id: 7,
    name: 'I1 DaySmart never discovery',
    company: 'Pinecrest Vet',
    email: 'hello@pinecrestvet.test',
    contact: 'Jamie',
    expect: { invariants: ['I1', 'I2'] },
    replies: [
      'Veterinary clinic for dogs and cats.',
      'Booking sick visits and vaccine appointments.',
      'Need pet name, species, and urgency.',
      'proceed',
      'DaySmart Vet',
      'nothing else',
    ],
  },
  {
    id: 8,
    name: 'I5 nothing else then looks good',
    company: 'Harbor Dental',
    email: 'front@harbordental.test',
    contact: 'Nina',
    expect: { invariants: ['I5'] },
    replies: [
      'Family dental practice.',
      'Book new-patient exams and emergencies.',
      'Must know pain level and insurance carrier.',
      'proceed',
      'none',
      'nothing else',
      'looks good',
    ],
  },
  {
    id: 9,
    name: 'I2 Impatient sample claim',
    company: 'QuickFix Plumbing',
    email: 'boss@quickfix.test',
    contact: 'Mike',
    expect: { invariants: ['I2'] },
    replies: [
      'Emergency plumbing.',
      'Lead qualify. Stop fluff — build something.',
      'proceed',
      'HubSpot',
      'nothing else',
    ],
  },
  {
    id: 10,
    name: 'I3+I5 brand then decline',
    company: 'GreenLeaf Landscaping',
    email: 'owen2@greenleaf.test',
    contact: 'Owen',
    expect: { invariants: ['I3', 'I5'], brandToken: 'GreenLeaf' },
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address and lot size.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Better. Nothing else.',
      'looks good',
    ],
  },
  {
    id: 11,
    name: 'I1 custom API after sample',
    company: 'NewCo Logistics',
    email: 'pat@newco.test',
    contact: 'Pat',
    expect: { invariants: ['I1', 'I2'] },
    replies: [
      'Last-mile delivery and dispatch.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'nothing else',
    ],
  },
  {
    id: 12,
    name: 'I4 Hire freight CRM ask',
    company: 'Atlas Freight',
    email: 'coo2@atlasfreight.test',
    contact: 'Blair',
    expect: { invariants: ['I4'] },
    replies: [
      'Regional freight brokerage.',
      'Qualify inbound shipper calls.',
      'Capture load type and equipment.',
      'Help me build it.',
      'HubSpot',
      'nothing else',
    ],
  },
];

BATCHES[71] = BATCHES[7];

/**
 * Batch 8 — Iteration 2 lead-artifact invariants (A1–A6).
 */
BATCHES[8] = [
  {
    id: 1,
    name: 'A1 Hire useCase hygiene',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    expect: { invariants: ['A1'] },
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Help me build it.',
      'none',
      'nothing else',
    ],
  },
  {
    id: 2,
    name: 'A2 Dispatch sample',
    company: 'NewCo Logistics',
    email: 'pat@newco.test',
    contact: 'Pat',
    expect: { invariants: ['A2'] },
    replies: [
      'Last-mile delivery and dispatch.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'nothing else',
    ],
  },
  {
    id: 3,
    name: 'A3 Roadside FleetCare',
    company: 'FleetCare Mobile',
    email: 'ceo@fleetcare.test',
    contact: 'Morgan',
    expect: { invariants: ['A1', 'A3'] },
    replies: [
      'Mobile fleet maintenance for delivery vans.',
      'We want Guidify to build a booking agent for roadside repairs.',
      'Need vehicle type, location, and urgency.',
      'Help me build it — please have Guidify build this.',
      'none',
      'nothing else',
    ],
  },
  {
    id: 4,
    name: 'A4 Transfer completes discovery',
    company: 'Westshore Heating',
    email: 'ops@westshore.test',
    contact: 'Dana',
    expect: { invariants: ['A4'] },
    replies: [
      'Residential HVAC install and repair in the Tampa Bay area.',
      'Qualify inbound leads and book a tech when urgent.',
      'Must know heating or cooling, zip, and unsafe conditions.',
      'Transfer on gas smell or no heat in freezing weather.',
      'Salesforce',
      'nothing else',
    ],
  },
  {
    id: 5,
    name: 'A5 Stacked corrections persist',
    company: 'GreenLeaf Landscaping',
    email: 'owen@greenleaf.test',
    contact: 'Owen',
    expect: { invariants: ['A5'], brandToken: 'GreenLeaf' },
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address and preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'Shorter closing.',
      'nothing else',
    ],
  },
  {
    id: 6,
    name: 'A6 Midstream rebrand',
    company: 'Old Name LLC',
    email: 'pat@rebrand.test',
    contact: 'Pat',
    expect: { invariants: ['A6', 'A2'] },
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'none',
      'looks good',
      'no',
    ],
  },
  {
    id: 7,
    name: 'A1 Impatient fluff useCase',
    company: 'QuickFix Plumbing',
    email: 'boss@quickfix.test',
    contact: 'Mike',
    expect: { invariants: ['A1'] },
    replies: [
      'Emergency plumbing.',
      'Lead qualify. Stop fluff — build something.',
      'proceed',
      'HubSpot',
      'nothing else',
    ],
  },
  {
    id: 8,
    name: 'A4 Dental transfer',
    company: 'Harbor Dental',
    email: 'front@harbordental.test',
    contact: 'Nina',
    expect: { invariants: ['A4'] },
    replies: [
      'Family dental practice.',
      'Book new-patient exams and emergencies.',
      'Must know pain level and insurance carrier.',
      'Transfer for swelling or uncontrolled bleeding.',
      'proceed',
      'none',
      'nothing else',
    ],
  },
  {
    id: 9,
    name: 'A2+A6 Dispatch after rebrand only',
    company: 'Old Name LLC',
    email: 'pat2@rebrand.test',
    contact: 'Pat',
    expect: { invariants: ['A6'] },
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'none',
      'nothing else',
    ],
  },
  {
    id: 10,
    name: 'A3 Roadside after must-know',
    company: 'FleetCare Mobile',
    email: 'ceo2@fleetcare.test',
    contact: 'Morgan',
    expect: { invariants: ['A3'] },
    replies: [
      'Mobile fleet maintenance for delivery vans.',
      'Book roadside repair visits from inbound calls.',
      'Need vehicle type, location, and urgency.',
      'proceed',
      'none',
      'nothing else',
    ],
  },
  {
    id: 11,
    name: 'A5 Brand+overgrown only',
    company: 'GreenLeaf Landscaping',
    email: 'owen2@greenleaf.test',
    contact: 'Owen',
    expect: { invariants: ['A5'], brandToken: 'GreenLeaf' },
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address and lot size.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'nothing else',
    ],
  },
  {
    id: 12,
    name: 'A1+A2 Freight qualify not hire fluff',
    company: 'Atlas Freight',
    email: 'coo2@atlasfreight.test',
    contact: 'Blair',
    expect: { invariants: ['A1'] },
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type and equipment.',
      'proceed',
      'HubSpot',
      'nothing else',
    ],
  },
];

BATCHES[81] = BATCHES[8];

/**
 * Batch 9 — Iteration 3 golden regression (I* + A* mix).
 */
BATCHES[9] = [
  {
    id: 1,
    name: 'CRM mid-discovery + sample',
    company: 'Westshore Heating',
    email: 'ops@westshore.test',
    contact: 'Dana',
    expect: { invariants: ['I1', 'I2', 'A4'] },
    replies: [
      'Residential HVAC install and repair in the Tampa Bay area.',
      'Qualify inbound leads and book a tech when urgent.',
      'Must know heating or cooling, zip, and unsafe conditions.',
      'Transfer on gas smell or no heat in freezing weather.',
      'Salesforce',
      'nothing else',
    ],
  },
  {
    id: 2,
    name: 'Hire hygiene + CRM',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    expect: { invariants: ['I2', 'I4', 'A1'] },
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Help me build it.',
      'none',
      'nothing else',
    ],
  },
  {
    id: 3,
    name: 'Dispatch vertical sample',
    company: 'NewCo Logistics',
    email: 'pat@newco.test',
    contact: 'Pat',
    expect: { invariants: ['A2', 'I2'] },
    replies: [
      'Last-mile delivery and dispatch.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'nothing else',
    ],
  },
  {
    id: 4,
    name: 'Brand + overgrown persist',
    company: 'GreenLeaf Landscaping',
    email: 'owen@greenleaf.test',
    contact: 'Owen',
    expect: { invariants: ['I3', 'A5', 'I5'], brandToken: 'GreenLeaf' },
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address and preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'nothing else',
      'looks good',
    ],
  },
  {
    id: 5,
    name: 'Sticky decline',
    company: 'Ledgerly',
    email: 'sam@ledgerly.test',
    contact: 'Sam',
    expect: { invariants: ['I5'] },
    replies: [
      'Bookkeeping software for freelancers.',
      'Answer common support FAQs on the phone so tickets drop.',
      'Must know account email; transfer refunds.',
      'proceed',
      'Zendesk',
      'Make the sample triage-first — ask what broke before FAQ answers.',
      'Better. Nothing else.',
      'looks good',
    ],
  },
  {
    id: 6,
    name: 'Roadside location urgency',
    company: 'FleetCare Mobile',
    email: 'ceo@fleetcare.test',
    contact: 'Morgan',
    expect: { invariants: ['A1', 'A3', 'I4'] },
    replies: [
      'Mobile fleet maintenance for delivery vans.',
      'We want Guidify to build a booking agent for roadside repairs.',
      'Need vehicle type, location, and urgency.',
      'Help me build it — please have Guidify build this.',
      'none',
      'nothing else',
    ],
  },
  {
    id: 7,
    name: 'Rebrand name + does',
    company: 'Old Name LLC',
    email: 'pat@rebrand.test',
    contact: 'Pat',
    expect: { invariants: ['A6', 'A2'] },
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'none',
      'no',
    ],
  },
  {
    id: 8,
    name: 'Impatient useCase clean',
    company: 'QuickFix Plumbing',
    email: 'boss@quickfix.test',
    contact: 'Mike',
    expect: { invariants: ['A1', 'I2'] },
    replies: [
      'Emergency plumbing.',
      'Lead qualify. Stop fluff — build something.',
      'proceed',
      'HubSpot',
      'nothing else',
    ],
  },
  {
    id: 9,
    name: 'Dental transfer complete',
    company: 'Harbor Dental',
    email: 'front@harbordental.test',
    contact: 'Nina',
    expect: { invariants: ['A4', 'I5'] },
    replies: [
      'Family dental practice.',
      'Book new-patient exams and emergencies.',
      'Must know pain level and insurance carrier.',
      'Transfer for swelling or uncontrolled bleeding.',
      'proceed',
      'none',
      'nothing else',
      'looks good',
    ],
  },
  {
    id: 10,
    name: 'Solar HubSpot quiet',
    company: 'Metro Solar',
    email: 'sales@metrosolar.test',
    contact: 'Kim',
    expect: { invariants: ['I1', 'I2'] },
    replies: [
      'Home solar sales and installs.',
      'Qualify owners for a free assessment.',
      'Need homeowner status and utility bill range.',
      'proceed',
      'HubSpot',
      'nothing else',
    ],
  },
  {
    id: 11,
    name: 'Vet CRM not discovery',
    company: 'Pinecrest Vet',
    email: 'hello@pinecrestvet.test',
    contact: 'Jamie',
    expect: { invariants: ['I1'] },
    replies: [
      'Veterinary clinic for dogs and cats.',
      'Booking sick visits and vaccine appointments.',
      'Need pet name, species, and urgency.',
      'proceed',
      'DaySmart Vet',
      'nothing else',
    ],
  },
  {
    id: 12,
    name: 'KB unanswered sticky',
    company: 'Harbor Dental',
    email: 'front2@harbordental.test',
    contact: 'Nina',
    expect: { invariants: ['I2', 'I5'] },
    replies: [
      'Family dental practice.',
      'Book new-patient exams and emergencies.',
      'Must know pain level and insurance.',
      'proceed',
      'none',
      'How much does Guidify pricing cost?',
      'Can you support on-prem SAP with custom SSO next week?',
      'nothing else',
      'looks good',
    ],
  },
  {
    id: 13,
    name: 'Vague default clean',
    company: 'Bright Ideas Co',
    email: 'hello@brightideas.test',
    contact: 'Jordan',
    expect: { invariants: ['I2'] },
    replies: [
      'We do a bit of everything in marketing.',
      'Not sure — maybe voice AI?',
      'Whatever usually works.',
      'proceed',
      'none',
      'nothing else',
    ],
  },
  {
    id: 14,
    name: 'CSAT no jargon + sticky',
    company: 'Nimbus Support',
    email: 'vp@nimbus.test',
    contact: 'Vic',
    expect: { invariants: ['I5'] },
    replies: [
      'B2B SaaS customer success.',
      'Deflect tier-1 calls without CSAT jargon in spoken lines.',
      'Must resolve password reset and invoice copy.',
      'proceed',
      'Intercom',
      'Do NOT put CSAT numbers in the spoken sample.',
      'nothing else',
      'looks good',
    ],
  },
  {
    id: 15,
    name: 'Stacked brand shorter persist',
    company: 'GreenLeaf Landscaping',
    email: 'owen3@greenleaf.test',
    contact: 'Owen',
    expect: { invariants: ['A5', 'I3'], brandToken: 'GreenLeaf' },
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address and preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'Shorter closing.',
      'nothing else',
    ],
  },
];

BATCHES[91] = BATCHES[9];

/**
 * Batch 10 — transfer-to-human wrap-up + light regression after mail-pattern work.
 */
BATCHES[10] = [
  {
    id: 1,
    name: 'T1 Transfer me to a human',
    company: 'Acme Labs',
    email: 'ceo@acme.test',
    contact: 'Alex',
    expect: { invariants: ['T1'] },
    replies: [
      'Software consulting.',
      'Qualify inbound leads.',
      'Need budget and timeline.',
      'Please transfer me to a human.',
    ],
  },
  {
    id: 2,
    name: 'T1 Talk to someone mid-sample',
    company: 'Metro Solar',
    email: 'sales@metrosolar.test',
    contact: 'Kim',
    expect: { invariants: ['T1', 'I2'] },
    replies: [
      'Home solar sales and installs.',
      'Qualify owners for a free assessment.',
      'Need homeowner status and utility bill range.',
      'proceed',
      'I want to speak to a real person.',
    ],
  },
  {
    id: 3,
    name: 'T2 Design transfer is not handoff',
    company: 'Westshore Heating',
    email: 'ops@westshore.test',
    contact: 'Dana',
    expect: { invariants: ['T2', 'A4'] },
    replies: [
      'Residential HVAC install and repair in the Tampa Bay area.',
      'Qualify inbound leads and book a tech when urgent.',
      'Must know heating or cooling, zip, and unsafe conditions.',
      'Transfer on gas smell or no heat in freezing weather.',
      'Salesforce',
      'nothing else',
    ],
  },
  {
    id: 4,
    name: 'Regression hire CRM',
    company: 'Atlas Freight',
    email: 'coo@atlasfreight.test',
    contact: 'Blair',
    expect: { invariants: ['I4', 'A1'] },
    replies: [
      'Regional freight brokerage.',
      'We want Guidify to build an inbound qualify agent end-to-end.',
      'Capture load type, origin/destination, and equipment needed.',
      'Help me build it.',
      'none',
      'nothing else',
    ],
  },
  {
    id: 5,
    name: 'Regression sticky decline',
    company: 'Ledgerly',
    email: 'sam@ledgerly.test',
    contact: 'Sam',
    expect: { invariants: ['I5'] },
    replies: [
      'Bookkeeping software for freelancers.',
      'Answer common support FAQs on the phone so tickets drop.',
      'Must know account email; transfer refunds.',
      'proceed',
      'Zendesk',
      'Better. Nothing else.',
      'looks good',
    ],
  },
  {
    id: 6,
    name: 'Regression dispatch sample',
    company: 'NewCo Logistics',
    email: 'pat@newco.test',
    contact: 'Pat',
    expect: { invariants: ['A2', 'I2'] },
    replies: [
      'Last-mile delivery and dispatch.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'custom internal API',
      'nothing else',
    ],
  },
  {
    id: 7,
    name: 'Regression brand stick',
    company: 'GreenLeaf Landscaping',
    email: 'owen@greenleaf.test',
    contact: 'Owen',
    expect: { invariants: ['I3', 'A5'], brandToken: 'GreenLeaf' },
    replies: [
      'Lawn care and landscaping.',
      'Book spring cleanups and mowing quotes.',
      'Need address and preferred day.',
      'proceed',
      'Jobber',
      'Change greeting — say GreenLeaf.',
      'Caller should mention overgrown backyard.',
      'nothing else',
    ],
  },
  {
    id: 8,
    name: 'T1 Human please short',
    company: 'QuickFix Plumbing',
    email: 'boss@quickfix.test',
    contact: 'Mike',
    expect: { invariants: ['T1'] },
    replies: [
      'Emergency plumbing.',
      'Lead qualify.',
      'Human please',
    ],
  },
];

/**
 * Batch 11 — session lifecycle: guest_exit vs transfer, early abandon, KB then exit.
 */
BATCHES[11] = [
  {
    id: 1,
    name: 'S1 Early goodbye is guest_exit',
    company: 'Abort Co',
    email: 'a@abort.test',
    contact: 'Ann',
    expect: { invariants: ['S1'] },
    replies: ['We do logistics.', 'goodbye'],
  },
  {
    id: 2,
    name: 'S1 Exit after sample not transfer',
    company: 'Harbor Dental',
    email: 'front@harbordental.test',
    contact: 'Nina',
    expect: { invariants: ['S1', 'I2'] },
    replies: [
      'Family dental practice.',
      'Book new-patient exams.',
      'Must know pain level.',
      'proceed',
      'none',
      'bye',
    ],
  },
  {
    id: 3,
    name: 'T1 after sticky decline',
    company: 'Ledgerly',
    email: 'sam2@ledgerly.test',
    contact: 'Sam',
    expect: { invariants: ['T1', 'I5'] },
    replies: [
      'Bookkeeping software for freelancers.',
      'Answer common support FAQs on the phone so tickets drop.',
      'Must know account email; transfer refunds.',
      'proceed',
      'Zendesk',
      'nothing else',
      'Please connect me to a human.',
    ],
  },
  {
    id: 4,
    name: 'S1 End chat after KB unanswered',
    company: 'Westshore Heating',
    email: 'ops2@westshore.test',
    contact: 'Dana',
    expect: { invariants: ['S1'] },
    replies: [
      'Residential HVAC.',
      'Qualify inbound leads.',
      'Must know zip and urgency.',
      'proceed',
      'Salesforce',
      'Can you support on-prem SAP with custom SSO next week?',
      'end conversation',
    ],
  },
  {
    id: 5,
    name: 'T2 Transfer rules still not handoff',
    company: 'Cedar Roofing',
    email: 'ops@cedarroof.test',
    contact: 'Alex',
    expect: { invariants: ['T2', 'A4'] },
    replies: [
      'Residential roofing.',
      'Qualify storm-damage leads.',
      'Must know zip and claim status.',
      'Transfer if active leak into living space.',
      'proceed',
      'JobNimbus',
      'nothing else',
    ],
  },
  {
    id: 6,
    name: 'T1 Speak to Guidify',
    company: 'Bright Ideas Co',
    email: 'hello@brightideas.test',
    contact: 'Jordan',
    expect: { invariants: ['T1'] },
    replies: [
      'Marketing agency.',
      'Qualify website leads.',
      'I need to talk to someone at Guidify.',
    ],
  },
  {
    id: 7,
    name: 'Regression rebrand A6',
    company: 'Old Name LLC',
    email: 'pat@rebrand.test',
    contact: 'Pat',
    expect: { invariants: ['A6', 'A2'] },
    replies: [
      'Actually we rebranded — we are NewCo Logistics, last-mile delivery.',
      'Inbound dispatch: confirm pickup window and driver ETA.',
      'Must know tracking number or phone on the order.',
      'proceed',
      'none',
      'no',
    ],
  },
  {
    id: 8,
    name: 'Regression roadside A3',
    company: 'FleetCare Mobile',
    email: 'ceo@fleetcare.test',
    contact: 'Morgan',
    expect: { invariants: ['A1', 'A3'] },
    replies: [
      'Mobile fleet maintenance for delivery vans.',
      'We want Guidify to build a booking agent for roadside repairs.',
      'Need vehicle type, location, and urgency.',
      'Help me build it.',
      'none',
      'nothing else',
    ],
  },
];

/** Batch 12 — full golden re-run after transfer/mail work. */
BATCHES[12] = BATCHES[9];

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 300));
  return json;
}

function humanScore(transcript, draft, persona = {}, meta = {}) {
  const asst = transcript.filter((t) => t.role === 'assistant').map((t) => t.content || '');
  const joined = asst.join('\n');
  const notes = [];
  let score = 10;
  const transferred = meta?.completedReason === 'transfer_human';
  const guestExited = meta?.completedReason === 'guest_exit';

  const sampleAt = asst.findIndex((a) => /\[\[SAMPLE_CALL\]\]/i.test(a));
  const lectureBeats = asst.filter((a) =>
    /Funnel:|analytics events|Flow nodes:|finite conversation flow/i.test(a),
  ).length;
  if (lectureBeats >= 2) {
    score -= 2;
    notes.push(`checklist_lecture=${lectureBeats}`);
  }
  if ((draft?.sampleLines || 0) === 0) {
    if (!transferred && !guestExited) {
      score -= 4;
      notes.push('no_sample');
    }
  } else if (sampleAt < 0) {
    score -= 2;
    notes.push('sample_not_shown');
  } else if (sampleAt > 8) {
    score -= 1;
    notes.push(`sample_late_turn=${sampleAt}`);
  }

  if (/\b(CSAT|AHT|containment rate)\b/i.test(joined)) {
    score -= 1;
    notes.push('metrics_jargon');
  }
  if (/what should count as a successful call/i.test(joined) && /qualif|book|faq|lead/i.test(draft?.useCase || '')) {
    score -= 1;
    notes.push('redundant_success_ask');
  }
  if ((draft?.sampleLines || 0) >= 6 && !/\[\[SAMPLE_CALL\]\]/i.test(joined)) {
    score -= 3;
    notes.push('sample_hidden_from_guest');
  }
  const multiQ = asst.filter((a) => (a.match(/\?/g) || []).length >= 2).length;
  if (multiQ) {
    score -= Math.min(2, multiQ);
    notes.push(`multi_q=${multiQ}`);
  }
  if (!(draft?.desiredResult || '').trim() && !(draft?.useCase || '').trim() && !transferred && !guestExited) {
    score -= 1;
    notes.push('weak_lead_desired');
  }
  if (!draft?.offerHelp && (draft?.sampleLines || 0) > 0) {
    score -= 1;
    notes.push('no_help_cta');
  }

  if (/updated the company name to|renamed (the )?company/i.test(joined)) {
    score -= 2;
    notes.push('crm_as_company_rename_speech');
  }
  const openQ = asst.filter((a) =>
    /anything else I can help/i.test(a),
  ).length;
  if ((draft?.sampleLines || 0) >= 6 && openQ < 1 && !/or say none|crm or tools/i.test(joined)) {
    score -= 1;
    notes.push('missing_open_question');
  }
  if (/I stay on designing your voice agent/i.test(joined)) {
    notes.push('weather_redirect_ok');
  }
  if (/I'll prepare|I have what I need to draft/i.test(joined) && sampleAt < 0) {
    score -= 1;
    notes.push('discovery_limbo_no_sample');
  }
  if (/want guidify to build|help me build it/i.test(draft?.useCase || '')) {
    score -= 1;
    notes.push('hire_language_as_use_case');
  }
  if (
    /dispatch|eta|pickup|tracking/i.test(draft?.useCase || '') &&
    draft?.samplePreview?.[1]?.text &&
    /new project/i.test(draft.samplePreview[1].text)
  ) {
    score -= 1;
    notes.push('wrong_sample_template');
  }

  const inv = checkInvariantsI(transcript, draft, persona);
  const invA = checkInvariantsA(transcript, draft, persona);
  const invT = checkInvariantsT(transcript, draft, persona, meta);
  for (const v of [...inv.violations, ...invA.violations, ...invT.violations]) {
    score -= 2;
    notes.push(v);
  }

  const gotSample = (draft?.sampleLines || 0) >= 6;
  const gotPath = Boolean(draft?.useCase);
  const gotContact = Boolean(draft?.companyName && draft?.contactEmail);
  // Transfer wrap-up can end before sample — still "needs met" if completed transfer.
  const callerNeedsMet =
    (gotSample && gotPath && gotContact) ||
    (meta?.completedReason === 'transfer_human' && gotContact) ||
    (meta?.completedReason === 'guest_exit' && gotContact);

  return {
    score: Math.max(0, score),
    notes,
    callerNeedsMet,
    openQuestionCount: openQ,
    sampleAtTurn: sampleAt >= 0 ? sampleAt : null,
    leadOk: gotContact && (gotPath || meta?.completedReason === 'transfer_human'),
    invariantViolations: [...inv.violations, ...invA.violations, ...invT.violations],
    completed: Boolean(meta?.completed),
    completedReason: meta?.completedReason || null,
  };
}

const CRM_TOKEN_RE =
  /\b(hubspot|salesforce|zendesk|intercom|jobber|jobnimbus|clio|toast|mcleod|follow up boss|daysmart|cloudbeds|appfolio|custom( internal)?( api)?)\b/i;

function checkInvariantsI(transcript, draft, persona = {}) {
  const violations = [];
  const want = new Set(persona.expect?.invariants || ['I1', 'I2', 'I3', 'I4', 'I5']);
  const asst = transcript.filter((t) => t.role === 'assistant').map((t) => t.content || '');
  const users = transcript.filter((t) => t.role === 'user').map((t) => t.content || '');

  // I1 — CRM never in discoveryAnswers
  if (want.has('I1')) {
    const answers = draft?.discoveryAnswerList || [];
    if (answers.some((a) => CRM_TOKEN_RE.test(a))) {
      violations.push('I1_crm_in_discovery');
    }
  }

  // I2 — claim sample ⇒ marker + lines
  if (want.has('I2')) {
    for (const a of asst) {
      if (
        /here('?s| is) a (sample|complete|design)|sample call|sample of the agent/i.test(a) &&
        !/\[\[SAMPLE_CALL\]\]/i.test(a)
      ) {
        violations.push('I2_sample_claim_without_marker');
        break;
      }
    }
    if ((draft?.sampleLines || 0) > 0 && (draft?.sampleLines || 0) < 6) {
      // short intentional samples OK if marker shown
    } else if (
      asst.some((a) => /\[\[SAMPLE_CALL\]\]/i.test(a)) &&
      (draft?.sampleLines || 0) < 6
    ) {
      violations.push('I2_sample_marker_thin_draft');
    }
  }

  // I3 — brand token in greeting after say X
  if (want.has('I3')) {
    const brand =
      persona.expect?.brandToken ||
      users
        .map((u) => u.match(/\bsay\s+([A-Z][\w]+)/)?.[1])
        .find(Boolean);
    const saidBrand = users.some((u) => /\bsay\s+[A-Z]/i.test(u) || /greeting/i.test(u));
    if (brand && saidBrand) {
      const greeting = draft?.sampleGreeting || '';
      const ok =
        new RegExp(`Thanks for calling ${brand}\\b`, 'i').test(greeting) ||
        new RegExp(`Thanks for calling ${brand}\\b`, 'i').test(
          (draft?.samplePreview || []).map((l) => l.text).join(' '),
        );
      if (!ok) violations.push('I3_brand_greeting_missing');
    }
  }

  // I4 — hire path asks CRM if integration empty before decline
  if (want.has('I4')) {
    const hired = users.some((u) => /help me build|hire guidify|have guidify/i.test(u));
    if (hired) {
      const integ = (draft?.integrationInterest || '').trim();
      const askedCrm = asst.some((a) =>
        /crm or tools|tools to connect|hubspot, salesforce|or say none|or none yet/i.test(a),
      );
      // Pass if CRM asked in chat OR integration already captured (guest answered)
      if (!askedCrm && !integ) {
        violations.push('I4_hire_missing_crm_ask');
      }
    }
  }

  // I5 — sticky decline
  if (want.has('I5')) {
    let declinedAt = -1;
    for (let i = 0; i < transcript.length; i++) {
      const m = transcript[i];
      if (
        m.role === 'user' &&
        /\bnothing else\b|\bbetter\.?\s*nothing else\b|^no\.?$/i.test(m.content || '')
      ) {
        declinedAt = i;
      }
    }
    if (declinedAt >= 0) {
      for (let i = declinedAt + 1; i < transcript.length; i++) {
        const m = transcript[i];
        if (
          m.role === 'assistant' &&
          /anything else I can help/i.test(m.content || '')
        ) {
          violations.push('I5_open_q_after_decline');
          break;
        }
      }
    }
  }

  return { violations };
}

function checkInvariantsA(transcript, draft, persona = {}) {
  const violations = [];
  const want = new Set(persona.expect?.invariants || []);
  if (!want.size) return { violations };

  const asst = transcript.filter((t) => t.role === 'assistant').map((t) => t.content || '');
  const users = transcript.filter((t) => t.role === 'user').map((t) => t.content || '');
  const sampleText = draft?.sampleText || [
    draft?.sampleGreeting || '',
    ...(draft?.samplePreview || []).map((l) => l.text || ''),
  ].join(' ');

  if (want.has('A1')) {
    if (/want guidify|help me build|stop fluff|build something/i.test(draft?.useCase || '')) {
      violations.push('A1_usecase_fluff');
    }
  }

  if (want.has('A2')) {
    if (/dispatch|eta|pickup|tracking/i.test(draft?.useCase || '')) {
      if (
        /new project/i.test(sampleText) ||
        !/tracking|pickup|eta|driver/i.test(sampleText)
      ) {
        violations.push('A2_dispatch_sample_mismatch');
      }
    }
  }

  if (want.has('A3')) {
    const roadsideContext =
      /roadside|fleet|van/i.test(
        [draft?.useCase, draft?.companyDoes, persona.company, ...(draft?.discoveryAnswerList || [])].join(
          ' ',
        ),
      ) || /FleetCare|roadside/i.test(persona.name || '');
    if (roadsideContext) {
      if (!/(location|where|highway)/i.test(sampleText) || !/urgent|urgency|soon/i.test(sampleText)) {
        violations.push('A3_roadside_missing_location_urgency');
      }
    }
  }

  if (want.has('A4')) {
    const transferIdx = users.findIndex((u) =>
      /\btransfer\b|gas smell|bleeding|toxin|active leak/i.test(u),
    );
    if (transferIdx >= 0) {
      // Next assistant should not be a soft-confirm multi-question; prefer CRM/sample/package.
      const nextAsst = transcript
        .slice(transcript.findIndex((m, i) => m.role === 'user' && m.content === users[transferIdx]) + 1)
        .find((m) => m.role === 'assistant');
      if (
        nextAsst &&
        /to confirm|is that correct|also,? is there/i.test(nextAsst.content || '') &&
        ((nextAsst.content || '').match(/\?/g) || []).length >= 2
      ) {
        violations.push('A4_soft_confirm_after_transfer');
      }
      if (!draft?.discoveryComplete && (draft?.sampleLines || 0) < 6) {
        violations.push('A4_discovery_not_complete_after_transfer');
      }
    }
  }

  if (want.has('A5')) {
    const brand = persona.expect?.brandToken || 'GreenLeaf';
    const saidBrand = users.some((u) => new RegExp(`say\\s+${brand}`, 'i').test(u));
    const saidOvergrown = users.some((u) => /overgrown|backyard/i.test(u));
    if (saidBrand && !new RegExp(`Thanks for calling ${brand}\\b`, 'i').test(sampleText)) {
      violations.push('A5_brand_lost');
    }
    if (saidOvergrown && !/overgrown/i.test(sampleText)) {
      violations.push('A5_overgrown_lost');
    }
  }

  if (want.has('A6')) {
    if (!/NewCo Logistics/i.test(draft?.companyName || '')) {
      violations.push('A6_rebrand_name_missing');
    }
    if (!/last-?mile/i.test(draft?.companyDoes || '')) {
      violations.push('A6_rebrand_does_missing');
    }
  }

  return { violations };
}

function checkInvariantsT(transcript, draft, persona = {}, meta = {}) {
  const violations = [];
  const want = new Set(persona.expect?.invariants || []);
  if (!want.size) return { violations };

  const users = transcript.filter((t) => t.role === 'user').map((t) => t.content || '');
  const asst = transcript.filter((t) => t.role === 'assistant').map((t) => t.content || '');
  const askedHuman = users.some((u) =>
    /\b(transfer me to a human|speak to a real person|talk to (a )?(human|someone)|human please|connect me (to|with) (a )?human)\b/i.test(
      u,
    ),
  );

  if (want.has('T1')) {
    if (!askedHuman) {
      violations.push('T1_no_human_ask_in_script');
    } else if (meta?.completedReason !== 'transfer_human') {
      violations.push('T1_missing_transfer_human_complete');
    } else if (
      !asst.some((a) => /wrap this up|guidify team follow up|follow up with you/i.test(a))
    ) {
      violations.push('T1_missing_wrap_message');
    }
  }

  if (want.has('T2')) {
    // Design transfer rules must not close the session as transfer_human.
    if (meta?.completedReason === 'transfer_human') {
      violations.push('T2_design_transfer_closed_session');
    }
  }

  if (want.has('S1')) {
    const askedExit = users.some((u) =>
      /^(bye|goodbye|exit|quit|end chat|end conversation)\.?$/i.test(u.trim()) ||
      /\bend (the )?(chat|conversation)\b/i.test(u),
    );
    const askedHuman = users.some((u) =>
      /\b(transfer me to a human|speak to a real person|talk to (a )?(human|someone)|human please|connect me (to|with) (a )?human|talk to someone at guidify)\b/i.test(
        u,
      ),
    );
    if (askedExit && !askedHuman) {
      if (meta?.completedReason !== 'guest_exit') {
        violations.push('S1_missing_guest_exit_complete');
      }
      if (meta?.completedReason === 'transfer_human') {
        violations.push('S1_exit_misclassified_as_transfer');
      }
    }
  }

  return { violations };
}

function summarizeDraft(d) {
  if (!d) return null;
  const sample = d.sampleConversation || [];
  const firstBot = sample.find((l) => l.role === 'bot');
  return {
    companyName: d.companyName,
    contactEmail: d.contactEmail,
    contactName: d.contactName,
    companyDoes: d.companyDoes,
    useCase: d.useCase,
    desiredResult: d.desiredResult,
    discoveryAnswers: d.discoveryAnswers?.length || 0,
    discoveryAnswerList: [...(d.discoveryAnswers || [])],
    discoveryComplete: d.discoveryComplete,
    funnels: (d.funnels || []).map((f) => f.label || f.id),
    sampleLines: sample.length,
    samplePreview: sample.slice(0, 4),
    sampleText: sample.map((l) => l.text || '').join(' '),
    sampleGreeting: firstBot?.text || '',
    spokenBrand: d.spokenBrand,
    sampleCallerHook: d.sampleCallerHook,
    integrationInterest: d.integrationInterest,
    offerHelp: d.offerHelp,
    correctionCount: d.correctionCount,
    unansweredQuestions: d.unansweredQuestions || [],
    declinedMoreHelp: d.declinedMoreHelp,
  };
}

async function runOne(persona) {
  const sessionId = randomUUID();
  const transcript = [];
  let draft = null;
  let messages = [];
  let completed = false;
  let completedReason = null;

  const intake = await post('/api/design/intake', {
    sessionId,
    companyName: persona.company,
    contactEmail: persona.email,
    contactName: persona.contact,
  });
  draft = intake.draft;
  messages = intake.messages || [];
  transcript.push({ role: 'assistant', content: intake.assistantMessage || '' });

  let replyIdx = 0;
  let turns = 0;
  while (turns < MAX_TURNS && replyIdx < persona.replies.length + 2) {
    const userText =
      persona.replies[replyIdx] ||
      (draft?.sampleConversation?.length ? 'looks good' : 'proceed');
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
    transcript.push({ role: 'assistant', content: turn.assistantMessage || '' });
    if (turn.completed) {
      completed = true;
      completedReason = turn.completedReason || 'completed';
      break;
    }
    if (
      draft?.offerHelp &&
      draft?.sampleConversation?.length &&
      /looks good|\bfine\b|\byes\b|\bok\b/i.test(userText) &&
      replyIdx >= persona.replies.length
    ) {
      break;
    }
    if (
      draft?.sampleConversation?.length &&
      wantsDone(userText) &&
      draft.offerHelp &&
      replyIdx >= persona.replies.length
    ) {
      break;
    }
  }

  const summary = summarizeDraft(draft);
  const human = humanScore(transcript, summary, persona, {
    completed,
    completedReason,
  });
  return {
    id: persona.id,
    name: persona.name,
    sessionId,
    turns,
    draft: summary,
    human,
    transcript,
    completed,
    completedReason,
  };
}

function wantsDone(t) {
  return /looks good|\bfine\b|\byes\b|\bok\b|thanks|ship|help me build/i.test(t);
}

async function main() {
  const personas = BATCHES[BATCH];
  if (!personas) {
    console.error('Unknown batch', BATCH);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Batch ${BATCH}: ${personas.length} convos @ ${BASE}`);
  const results = [];
  for (const p of personas) {
    process.stdout.write(`#${p.id} ${p.name} ... `);
    try {
      const r = await runOne(p);
      results.push(r);
      const inv = (r.human.invariantViolations || []).join(',') || 'none';
      console.log(
        `score=${r.human.score} turns=${r.turns} sample=${r.draft?.sampleLines || 0} needs=${r.human.callerNeedsMet} inv=${inv} notes=${r.human.notes.join(',') || 'none'}`,
      );
    } catch (e) {
      console.log('FAIL', e.message || e);
      results.push({
        id: p.id,
        name: p.name,
        error: String(e.message || e),
        human: { score: 0, notes: ['error'], callerNeedsMet: false, invariantViolations: ['error'] },
      });
    }
  }
  const avg =
    results.reduce((s, r) => s + (r.human?.score || 0), 0) / Math.max(1, results.length);
  const invHits = results.flatMap((r) => r.human?.invariantViolations || []);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(OUT_DIR, `batch${BATCH}-${stamp}.json`);
  writeFileSync(
    path,
    JSON.stringify(
      { batch: BATCH, avgScore: avg, invariantViolations: invHits, results },
      null,
      2,
    ),
  );
  console.log(`\navgScore=${avg.toFixed(1)} invariantHits=${invHits.length} wrote ${path}`);
  if (invHits.length > 0 || avg < 9.5) {
    console.error('GATE FAIL');
    process.exit(1);
  }
  console.log('GATE PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
