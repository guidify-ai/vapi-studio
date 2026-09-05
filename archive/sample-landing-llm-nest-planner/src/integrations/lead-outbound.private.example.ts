/**
 * EXAMPLE — copy to `src/private/lead-outbound.ts` (that path is gitignored).
 * Do not put real inboxes or API wiring in the tracked tree.
 *
 * Every Resend email uses the shared Outcome pattern from lead-outbound-format.ts:
 * SUCCESS_LEAD | QUOTE_REQUEST | TRANSFER_HUMAN | FAILED_LEAD
 */
import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import type { LeadEntity } from '../leads/lead.entity';
import {
  classifyClosedSession,
  companyForMail,
  leadMailSubject,
  renderLeadMail,
} from './lead-outbound-format';
import type {
  HotLeadPayload,
  LeadOutbound,
  QuoteRequestPayload,
  SessionClosedPayload,
  TransferHumanPayload,
} from './lead-outbound.types';

const log = new Logger('PrivateLeadOutbound');

function enabled(): boolean {
  const flag = (process.env.RESEND_ENABLED || '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no' || flag === 'off') {
    return false;
  }
  if (flag === 'true' || flag === '1' || flag === 'yes' || flag === 'on') {
    return true;
  }
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function client(): Resend | null {
  if (!enabled()) {
    log.log('Resend disabled — skipping email');
    return null;
  }
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    log.warn('RESEND_API_KEY missing — skipping email');
    return null;
  }
  return new Resend(key);
}

function fromAddr(): string {
  return (
    process.env.RESEND_FROM?.trim() || 'Vapi Studio <onboarding@resend.dev>'
  );
}

/** Recipient comes only from env — never hardcode in the public repo. */
function toAddr(): string {
  const to = process.env.HOT_LEAD_TO?.trim();
  if (!to) {
    log.warn('HOT_LEAD_TO missing — skipping email');
    return '';
  }
  return to;
}

async function send(subject: string, html: string): Promise<boolean> {
  const resend = client();
  const to = toAddr();
  if (!resend || !to) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: fromAddr(),
      to: [to],
      subject,
      html,
    });
    if (error) {
      log.warn(`Resend error: ${error.message}`);
      return false;
    }
    log.log(`Email sent id=${data?.id || '?'} subject=${subject.slice(0, 80)}`);
    return true;
  } catch (err) {
    log.warn(`Resend failed: ${err}`);
    return false;
  }
}

export function createLeadOutbound(): LeadOutbound {
  return {
    async sendHotLeadAlert(input: HotLeadPayload) {
      const company = companyForMail(input.draft);
      return send(
        leadMailSubject('SUCCESS_LEAD', company),
        renderLeadMail({
          outcome: 'SUCCESS_LEAD',
          why: input.reason || 'Planner flagged an engaged design session.',
          sessionId: input.sessionId,
          draft: input.draft,
          privateQuote: input.privateQuote,
          messages: input.messages,
        }),
      );
    },
    async sendQuoteRequest(input: QuoteRequestPayload) {
      const company = companyForMail(
        input.draft,
        input.company || input.draft?.companyName,
      );
      return send(
        leadMailSubject('QUOTE_REQUEST', company),
        renderLeadMail({
          outcome: 'QUOTE_REQUEST',
          why: `Visitor submitted Help me build it.${
            input.notes ? ` Notes: ${input.notes}` : ''
          }`.trim(),
          sessionId: input.sessionId,
          draft: input.draft,
          privateQuote: input.privateQuote,
          messages: input.messages,
          contactOverride: {
            name: input.name,
            email: input.email,
            company: input.company || undefined,
          },
        }),
      );
    },
    async sendTransferHumanAlert(input: TransferHumanPayload) {
      const company = companyForMail(input.draft);
      const trigger = (input.triggerText || '').trim();
      return send(
        leadMailSubject('TRANSFER_HUMAN', company),
        renderLeadMail({
          outcome: 'TRANSFER_HUMAN',
          why: trigger
            ? `Guest asked for a human. Trigger: “${trigger.slice(0, 200)}”`
            : 'Guest asked for a human. Conversation wrapped; no live handoff on this site.',
          sessionId: input.sessionId,
          draft: input.draft,
          privateQuote: input.privateQuote,
          messages: input.messages,
          closedReason: 'transfer_human',
        }),
      );
    },
    async sendSessionClosedAlert(input: SessionClosedPayload) {
      const outcome = classifyClosedSession(input.draft);
      const company = companyForMail(input.draft);
      const why =
        outcome === 'SUCCESS_LEAD'
          ? `Session closed after useful engagement (${input.closedReason}). Follow up while context is fresh.`
          : `Session closed without a usable draft (${input.closedReason}). Likely abandoned / low intent.`;
      return send(
        leadMailSubject(outcome, company),
        renderLeadMail({
          outcome,
          why,
          sessionId: input.sessionId,
          draft: input.draft,
          privateQuote: input.privateQuote,
          messages: input.messages,
          closedReason: input.closedReason,
        }),
      );
    },
    async postLeadWebhook(lead: LeadEntity) {
      const url = process.env.LEAD_WEBHOOK_URL?.trim();
      if (!url) return;
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          sessionId: lead.sessionId,
          // Intentionally minimal in the example — expand only in private/.
        }),
      });
    },
  };
}
