/**
 * Shared Resend email pattern for Guidify outbound.
 * Every planner email uses the same Outcome / Meaning / Why header.
 */
import type { ChatMessage, DesignDraftPublic, PrivateQuote } from '../leads/design-types';

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
      'Visitor submitted Help me build it — clear commercial intent to hire Guidify.',
  },
  TRANSFER_HUMAN: {
    code: 'TRANSFER_HUMAN',
    label: 'Transfer to human',
    meaning:
      'Guest asked for a human. Conversation wrapped on this site (no live handoff) — Guidify should follow up.',
  },
  FAILED_LEAD: {
    code: 'FAILED_LEAD',
    label: 'Failed / abandoned lead',
    meaning:
      'Session closed without a usable draft or clear hire intent — low priority unless context says otherwise.',
  },
};

export type LeadMailRenderInput = {
  outcome: LeadMailOutcome;
  why: string;
  sessionId: string;
  draft: DesignDraftPublic | null;
  privateQuote: PrivateQuote | null;
  messages: ChatMessage[];
  contactOverride?: { name?: string; email?: string; company?: string };
  /** Extra closed-reason line (left_site | idle_timeout | guest_exit | …). */
  closedReason?: string;
};

export function companyForMail(
  draft: DesignDraftPublic | null | undefined,
  override?: string | null,
): string {
  return (override || draft?.companyName || 'unknown').trim() || 'unknown';
}

/** Subject line — same pattern for every sendout. */
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

/**
 * HTML body — Outcome / Meaning / Why always first, then contact + transcript.
 */
export function renderLeadMail(input: LeadMailRenderInput): string {
  const meta = LEAD_MAIL_OUTCOMES[input.outcome];
  const d = input.draft || {};
  const name = input.contactOverride?.name || d.contactName || '—';
  const email = input.contactOverride?.email || d.contactEmail || '—';
  const company =
    input.contactOverride?.company || d.companyName || '—';
  const pq = input.privateQuote;
  const unanswered = (pq?.unansweredQuestions || d.unansweredQuestions || [])
    .map((q) => `<li>${escapeHtml(String(q))}</li>`)
    .join('');
  const discovery = (d.discoveryAnswers || [])
    .map((a) => `<li>${escapeHtml(String(a))}</li>`)
    .join('');
  const transcript = (input.messages || [])
    .slice(-40)
    .map(
      (m) =>
        `<p style="margin:0.4rem 0"><strong>${escapeHtml(m.role)}</strong>: ${escapeHtml(
          m.content,
        ).replace(/\n/g, '<br/>')}</p>`,
    )
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
    <span style="display:inline-block;padding:0.25rem 0.55rem;border-radius:4px;background:${badgeColor};color:#fff;font-size:0.8rem;font-weight:700;letter-spacing:0.02em">${escapeHtml(
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
      (d.useCase || '').trim()
        ? `<li><strong>Use case:</strong> ${escapeHtml(String(d.useCase))}</li>`
        : ''
    }
  </ul>
  ${
    unanswered
      ? `<h2 style="font-size:1.05rem">Unanswered questions</h2><ul>${unanswered}</ul>`
      : ''
  }
  ${
    discovery
      ? `<h2 style="font-size:1.05rem">Discovery</h2><ul>${discovery}</ul>`
      : ''
  }
  <h2 style="font-size:1.05rem">Recent transcript</h2>
  <div style="border:1px solid #ddd;padding:0.75rem;background:#fafafa">${
    transcript || '<p>—</p>'
  }</div>
</body></html>`;
}

/** Classify a closed session without quote/transfer as success vs failed lead. */
export function classifyClosedSession(
  draft: DesignDraftPublic | null | undefined,
): LeadMailOutcome {
  const d = draft || {};
  const hasContact = Boolean(
    (d.companyName || '').trim() &&
      (d.contactEmail || '').trim() &&
      (d.contactName || '').trim(),
  );
  const hasCase = Boolean((d.useCase || '').trim());
  const hasSample = (d.sampleConversation || []).length >= 6;
  const discoveryOk =
    Boolean(d.discoveryComplete) || (d.discoveryAnswers || []).length >= 2;
  if (hasContact && hasCase && (hasSample || discoveryOk || d.offerHelp)) {
    return 'SUCCESS_LEAD';
  }
  return 'FAILED_LEAD';
}
