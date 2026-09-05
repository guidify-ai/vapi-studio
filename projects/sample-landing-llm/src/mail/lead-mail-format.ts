/**
 * Shared Resend email pattern for Guidify outbound from the Studio sample.
 * Outcomes: SUCCESS_LEAD | QUOTE_REQUEST | TRANSFER_HUMAN | FAILED_LEAD
 */

export type LeadMailOutcome =
  | 'SUCCESS_LEAD'
  | 'QUOTE_REQUEST'
  | 'TRANSFER_HUMAN'
  | 'FAILED_LEAD';

export const LEAD_MAIL_OUTCOMES: Record<
  LeadMailOutcome,
  { code: LeadMailOutcome; label: string; meaning: string }
> = {
  SUCCESS_LEAD: {
    code: 'SUCCESS_LEAD',
    label: 'Success lead',
    meaning:
      'Engaged visitor with a usable design draft — worth Guidify follow-up.',
  },
  QUOTE_REQUEST: {
    code: 'QUOTE_REQUEST',
    label: 'Quote request',
    meaning:
      'Visitor said Help me build it — clear commercial intent to hire Guidify.',
  },
  TRANSFER_HUMAN: {
    code: 'TRANSFER_HUMAN',
    label: 'Transfer to human',
    meaning:
      'Guest asked for a human. Conversation wrapped (no live handoff on web) — Guidify should follow up.',
  },
  FAILED_LEAD: {
    code: 'FAILED_LEAD',
    label: 'Failed / abandoned lead',
    meaning:
      'Session closed without a usable draft or clear hire intent — low priority.',
  },
};

export type LeadMailContact = {
  name?: string;
  email?: string;
  company?: string;
};

export type LeadMailRenderInput = {
  outcome: LeadMailOutcome;
  why: string;
  sessionId: string;
  contact: LeadMailContact;
  useCase?: string;
  companyDoes?: string;
  discoveryAnswers?: string[];
  samplePreview?: string;
  closedReason?: string;
};

export function leadMailSubject(
  outcome: LeadMailOutcome,
  company: string,
): string {
  const meta = LEAD_MAIL_OUTCOMES[outcome];
  return `[Vapi Studio] ${meta.code} — ${company || 'unknown'}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLeadMail(input: LeadMailRenderInput): string {
  const meta = LEAD_MAIL_OUTCOMES[input.outcome];
  const name = input.contact.name || '—';
  const email = input.contact.email || '—';
  const company = input.contact.company || '—';
  const discovery = (input.discoveryAnswers || [])
    .map((a) => `<li>${escapeHtml(String(a))}</li>`)
    .join('');
  const badgeColor =
    input.outcome === 'SUCCESS_LEAD' || input.outcome === 'QUOTE_REQUEST'
      ? '#0b6e4f'
      : input.outcome === 'TRANSFER_HUMAN'
        ? '#9a5b00'
        : '#8a1c1c';

  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.45;color:#111">
  <p style="margin:0 0 0.75rem">
    <span style="display:inline-block;padding:0.25rem 0.55rem;border-radius:4px;background:${badgeColor};color:#fff;font-size:0.8rem;font-weight:700">${escapeHtml(
      meta.code,
    )}</span>
  </p>
  <h1 style="font-size:1.25rem;margin:0 0 0.5rem">${escapeHtml(meta.label)}</h1>
  <table style="border-collapse:collapse;width:100%;max-width:40rem;margin:0 0 1rem;font-size:0.95rem">
    <tr>
      <td style="padding:0.35rem 0.5rem 0.35rem 0;vertical-align:top;color:#555;width:7rem"><strong>Outcome</strong></td>
      <td style="padding:0.35rem 0"><code>${escapeHtml(meta.code)}</code> — ${escapeHtml(meta.label)}</td>
    </tr>
    <tr>
      <td style="padding:0.35rem 0.5rem 0.35rem 0;vertical-align:top;color:#555"><strong>Meaning</strong></td>
      <td style="padding:0.35rem 0">${escapeHtml(meta.meaning)}</td>
    </tr>
    <tr>
      <td style="padding:0.35rem 0.5rem 0.35rem 0;vertical-align:top;color:#555"><strong>Why</strong></td>
      <td style="padding:0.35rem 0">${escapeHtml(input.why || '—')}</td>
    </tr>
    ${
      input.closedReason
        ? `<tr>
      <td style="padding:0.35rem 0.5rem 0.35rem 0;vertical-align:top;color:#555"><strong>Closed as</strong></td>
      <td style="padding:0.35rem 0"><code>${escapeHtml(input.closedReason)}</code></td>
    </tr>`
        : ''
    }
  </table>
  <h2 style="font-size:1.05rem">Contact</h2>
  <ul>
    <li><strong>Company:</strong> ${escapeHtml(company)}</li>
    <li><strong>Name:</strong> ${escapeHtml(name)}</li>
    <li><strong>Email:</strong> ${escapeHtml(email)}</li>
    <li><strong>Session:</strong> <code>${escapeHtml(input.sessionId)}</code></li>
    ${
      (input.useCase || '').trim()
        ? `<li><strong>Use case:</strong> ${escapeHtml(String(input.useCase))}</li>`
        : ''
    }
    ${
      (input.companyDoes || '').trim()
        ? `<li><strong>Company does:</strong> ${escapeHtml(String(input.companyDoes))}</li>`
        : ''
    }
  </ul>
  ${
    discovery
      ? `<h2 style="font-size:1.05rem">Discovery</h2><ul>${discovery}</ul>`
      : ''
  }
  ${
    input.samplePreview
      ? `<h2 style="font-size:1.05rem">Sample preview</h2><pre style="white-space:pre-wrap;background:#f6f6f6;padding:0.75rem;border-radius:6px;font-size:0.85rem">${escapeHtml(
          input.samplePreview.slice(0, 2500),
        )}</pre>`
      : ''
  }
  <p style="color:#666;font-size:0.85rem;margin-top:1.5rem">Sent from sample-landing-llm (Studio :9998).</p>
</body></html>`;
}
