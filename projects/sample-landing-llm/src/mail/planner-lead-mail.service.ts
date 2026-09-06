import { Injectable, Logger } from '@nestjs/common';
import type { NodeContext } from '@guidify-ai/vapi-studio';
import type { PlannerSchema } from '../conversation/planner-schema';
import {
  leadMailSubject,
  renderLeadMail,
  type LeadMailOutcome,
} from './lead-mail-format';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type NotifyKind = 'success_lead' | 'quote_request' | 'transfer_human';

/**
 * Wrap-up / hot-lead alerts to HOT_LEAD_TO via Resend.
 * Fires early on first sample (SUCCESS_LEAD), then upgrade on hire / transfer.
 */
@Injectable()
export class PlannerLeadMailService {
  private readonly log = new Logger(PlannerLeadMailService.name);

  private enabled(): boolean {
    const flag = (process.env.RESEND_ENABLED || '').trim().toLowerCase();
    if (flag === 'false' || flag === '0' || flag === 'no' || flag === 'off') {
      return false;
    }
    if (flag === 'true' || flag === '1' || flag === 'yes' || flag === 'on') {
      return true;
    }
    return Boolean(process.env.RESEND_API_KEY?.trim());
  }

  private toAddr(): string {
    return (process.env.HOT_LEAD_TO || '').trim();
  }

  private fromAddr(): string {
    return (
      process.env.RESEND_FROM?.trim() ||
      'Vapi Studio <onboarding@resend.dev>'
    );
  }

  /** First sample shown — SUCCESS_LEAD while guest is still in chat. */
  async notifySampleReady(
    ctx: NodeContext<PlannerSchema>,
  ): Promise<void> {
    await this.notify(ctx, 'success_lead', {
      why: `${ctx.memory.companyName || 'Lead'} completed discovery + sample (${
        ctx.memory.useCase || 'use case'
      })`,
    });
  }

  /** Help me build it — QUOTE_REQUEST (may re-mail even after SUCCESS_LEAD). */
  async notifyQuoteRequested(
    ctx: NodeContext<PlannerSchema>,
  ): Promise<void> {
    await this.notify(ctx, 'quote_request', {
      why: 'Visitor said Help me build it — commercial hire intent.',
      allowAfterSuccess: true,
    });
  }

  /** Web transfer wrap — TRANSFER_HUMAN. */
  async notifyTransferHuman(
    ctx: NodeContext<PlannerSchema>,
    triggerText?: string,
  ): Promise<void> {
    const trigger = (triggerText || ctx.userText || '').trim();
    await this.notify(ctx, 'transfer_human', {
      why: trigger
        ? `Guest asked for a human. Trigger: “${trigger.slice(0, 200)}”`
        : 'Guest asked for a human. Conversation wrapped; Guidify should follow up.',
      closedReason: 'transfer_human',
      allowAfterSuccess: true,
    });
  }

  /** Outbound phone demo — use-case capture (SUCCESS_LEAD). */
  async notifyPhoneDemoLead(
    ctx: NodeContext<PlannerSchema>,
  ): Promise<void> {
    const topic = ctx.memory.phoneDemoTopic || 'unknown';
    const useCase = (ctx.memory.companyDoes || '').trim().slice(0, 280);
    const heard = (ctx.memory.heardAbout || '').trim().slice(0, 200);
    await this.notify(ctx, 'success_lead', {
      why:
        `Outbound phone demo — topic=${topic}. Desired module: “${useCase || 'n/a'}”.` +
        (heard ? ` Heard about: “${heard}”.` : ''),
      closedReason: 'phone_demo_lead',
      allowAfterSuccess: true,
    });
  }

  /** Landing “Call me” — no Conversation ctx yet; still alert Guidify. */
  async notifyOutboundCallRequest(input: {
    companyName: string;
    contactName: string;
    contactEmail: string;
    phone: string;
    notes?: string;
  }): Promise<void> {
    if (!this.enabled()) {
      this.log.log('Resend disabled — skipping outbound-call mail');
      return;
    }
    const to = this.toAddr();
    const key = process.env.RESEND_API_KEY?.trim();
    if (!to || !key) {
      this.log.warn('Resend env missing — skipping outbound-call mail');
      return;
    }
    const company = input.companyName.trim() || 'unknown';
    const why = `Guest requested an outbound triage call to ${input.phone}.${
      input.notes ? ` Notes: ${input.notes.slice(0, 200)}` : ''
    }`;
    const html = renderLeadMail({
      outcome: 'QUOTE_REQUEST',
      why,
      sessionId: `outbound-${Date.now().toString(36)}`,
      contact: {
        name: input.contactName,
        email: input.contactEmail,
        company,
      },
      closedReason: 'outbound_call_request',
    });
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddr(),
          to: [to],
          subject: leadMailSubject('QUOTE_REQUEST', company),
          html: html.replace(
            '</ul>',
            `<li><strong>Phone:</strong> ${escapeHtml(input.phone)}</li></ul>`,
          ),
        }),
      });
      if (!res.ok) {
        this.log.warn(`Resend error ${res.status}`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      this.log.log(
        `Outbound-call mail sent id=${data.id || '?'} to=${to}`,
      );
    } catch (err) {
      this.log.warn(`Resend failed: ${err}`);
    }
  }

  private async notify(
    ctx: NodeContext<PlannerSchema>,
    kind: NotifyKind,
    opts: {
      why: string;
      closedReason?: string;
      allowAfterSuccess?: boolean;
    },
  ): Promise<void> {
    const mem = ctx.memory;
    if (kind === 'success_lead' && mem.leadMailSuccessSent) return;
    if (kind === 'quote_request' && mem.leadMailQuoteSent) return;
    if (kind === 'transfer_human' && mem.leadMailTransferSent) return;
    if (
      kind === 'success_lead' &&
      (mem.leadMailQuoteSent || mem.leadMailTransferSent)
    ) {
      return;
    }

    if (!this.enabled()) {
      this.log.log('Resend disabled — skipping lead mail');
      return;
    }
    const to = this.toAddr();
    const key = process.env.RESEND_API_KEY?.trim();
    if (!to) {
      this.log.warn('HOT_LEAD_TO missing — skipping lead mail');
      return;
    }
    if (!key) {
      this.log.warn('RESEND_API_KEY missing — skipping lead mail');
      return;
    }

    const outcome: LeadMailOutcome =
      kind === 'quote_request'
        ? 'QUOTE_REQUEST'
        : kind === 'transfer_human'
          ? 'TRANSFER_HUMAN'
          : 'SUCCESS_LEAD';

    const company =
      mem.companyName?.trim() ||
      ctx.conversation.variables.guestCompanyName?.trim() ||
      'unknown';
    const sessionId = String(ctx.conversation.id || 'unknown');
    const html = renderLeadMail({
      outcome,
      why: opts.why,
      sessionId,
      contact: {
        name: mem.contactName,
        email: mem.contactEmail,
        company,
      },
      useCase: mem.useCase,
      companyDoes: mem.companyDoes,
      discoveryAnswers: mem.discoveryAnswers,
      samplePreview: mem.designDraft?.sampleConversation,
      closedReason: opts.closedReason,
    });

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddr(),
          to: [to],
          subject: leadMailSubject(outcome, company),
          html,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.log.warn(
          `Resend error ${res.status}: ${body.slice(0, 200)}`,
        );
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      this.log.log(
        `Lead mail sent outcome=${outcome} id=${data.id || '?'} to=${to}`,
      );
      if (kind === 'success_lead') mem.leadMailSuccessSent = true;
      if (kind === 'quote_request') mem.leadMailQuoteSent = true;
      if (kind === 'transfer_human') mem.leadMailTransferSent = true;
      // silence unused allowAfterSuccess (documents intent for callers)
      void opts.allowAfterSuccess;
    } catch (err) {
      this.log.warn(`Resend failed: ${err}`);
    }
  }
}
