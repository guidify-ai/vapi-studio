import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadEntity } from './lead.entity';
import {
  conversationsPerDayLimit,
  utcDayStart,
} from '../client-ip';
import { LeadOutboundService } from '../integrations/lead-outbound.service';
import type {
  ChatMessage,
  DesignDraftPublic,
  PrivateQuote,
} from './design-types';

export type {
  ChatMessage,
  DesignDraftPublic,
  DesignAnalyticsEvent,
  DesignFunnel,
  DesignFlowNode,
  DesignSampleLine,
  PrivateQuote,
} from './design-types';

export type SessionCompleteReason =
  | 'left_site'
  | 'idle_timeout'
  | 'guest_exit'
  | 'transfer_human';

const IDLE_MS_DEFAULT = 30 * 60 * 1000;

export function sessionIdleMs(): number {
  const n = Number(process.env.SESSION_IDLE_MS || IDLE_MS_DEFAULT);
  return Number.isFinite(n) && n >= 60_000 ? n : IDLE_MS_DEFAULT;
}

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly repo: Repository<LeadEntity>,
    private readonly mail: LeadOutboundService,
  ) {}

  /**
   * New conversations are capped per IP per UTC day.
   * Existing sessionIds may continue without counting again.
   */
  async assertConversationAllowed(
    sessionId: string,
    clientIp: string,
  ): Promise<void> {
    const existing = await this.repo.findOne({ where: { sessionId } });
    if (existing) return;

    const limit = conversationsPerDayLimit();
    const since = utcDayStart();
    const count = await this.repo
      .createQueryBuilder('lead')
      .where('lead.clientIp = :clientIp', { clientIp })
      .andWhere('lead.createdAt >= :since', { since })
      .getCount();

    if (count >= limit) {
      throw new HttpException(
        {
          ok: false,
          error: 'rate_limited',
          message: `Conversation limit reached (${limit} per day from this network). Try again tomorrow, or email mpyskunov@guidify.ca.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async getDesignDraft(sessionId: string): Promise<DesignDraftPublic | null> {
    const lead = await this.repo.findOne({ where: { sessionId } });
    if (!lead?.designDraft) return null;
    return lead.designDraft as unknown as DesignDraftPublic;
  }

  async getLead(sessionId: string): Promise<LeadEntity | null> {
    return this.repo.findOne({ where: { sessionId } });
  }

  isTerminal(lead: LeadEntity | null | undefined): boolean {
    if (!lead) return false;
    return lead.status === 'quoted' || lead.status === 'completed';
  }

  /**
   * Mark a design session complete (idempotent).
   * Does not downgrade quoted → completed.
   */
  async completeSession(input: {
    sessionId: string;
    reason: SessionCompleteReason;
  }): Promise<LeadEntity | null> {
    const lead = await this.repo.findOne({
      where: { sessionId: input.sessionId },
    });
    if (!lead) return null;
    if (lead.status === 'quoted') return lead;
    if (lead.status === 'completed' && lead.completedAt) return lead;
    lead.status = 'completed';
    lead.completedAt = new Date();
    lead.completedReason = input.reason;
    const saved = await this.repo.save(lead);
    // Transfer / quote have their own patterned emails — don't double-send.
    if (
      input.reason === 'left_site' ||
      input.reason === 'idle_timeout' ||
      input.reason === 'guest_exit'
    ) {
      void this.notifySessionClosed(saved, input.reason).catch((err) =>
        console.warn('[leads] session-closed notify failed', err),
      );
    }
    return saved;
  }

  /**
   * If the last activity is older than the idle window, close as idle_timeout.
   */
  async completeIfIdle(sessionId: string): Promise<LeadEntity | null> {
    const lead = await this.repo.findOne({ where: { sessionId } });
    if (!lead || this.isTerminal(lead)) return lead;
    const idleMs = sessionIdleMs();
    const anchor =
      lead.updatedAt?.getTime?.() || lead.createdAt?.getTime?.() || 0;
    if (anchor && Date.now() - anchor >= idleMs) {
      return this.completeSession({ sessionId, reason: 'idle_timeout' });
    }
    return lead;
  }

  async upsertDesignSession(input: {
    sessionId: string;
    clientIp?: string;
    messages: ChatMessage[];
    designDraft: DesignDraftPublic | null;
    privateQuote: PrivateQuote | null;
  }): Promise<LeadEntity> {
    let lead = await this.repo.findOne({ where: { sessionId: input.sessionId } });
    if (lead && this.isTerminal(lead)) {
      return lead;
    }
    if (!lead) {
      lead = this.repo.create({
        sessionId: input.sessionId,
        clientIp: input.clientIp || null,
        status: 'design',
        messages: [],
      });
    } else if (!lead.clientIp && input.clientIp) {
      lead.clientIp = input.clientIp;
    }
    lead.messages = input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    lead.designDraft = (input.designDraft || null) as Record<string, unknown> | null;
    if (input.privateQuote) {
      lead.complexity = input.privateQuote.complexity ?? lead.complexity;
      lead.quoteHours =
        typeof input.privateQuote.quoteHours === 'number'
          ? input.privateQuote.quoteHours
          : lead.quoteHours;
      lead.quoteRationale =
        input.privateQuote.rationale ?? lead.quoteRationale;
      const priorUnanswered = Array.isArray(lead.unansweredQuestions)
        ? lead.unansweredQuestions
        : [];
      const nextUnanswered = Array.isArray(input.privateQuote.unansweredQuestions)
        ? input.privateQuote.unansweredQuestions
        : [];
      const mergedUnanswered = [
        ...new Set(
          [...priorUnanswered, ...nextUnanswered]
            .map((q) => String(q || '').trim())
            .filter(Boolean),
        ),
      ].slice(0, 40);
      lead.unansweredQuestions = mergedUnanswered;
      lead.privateQuote = {
        ...(input.privateQuote as Record<string, unknown>),
        unansweredQuestions: mergedUnanswered,
      };
      const draft = input.designDraft;
      if (draft?.contactEmail && !lead.email) {
        lead.email = draft.contactEmail.slice(0, 320);
      }
      if (draft?.contactName && !lead.name) {
        lead.name = draft.contactName.slice(0, 200);
      }
      if (draft?.companyName && !lead.company) {
        lead.company = draft.companyName.slice(0, 200);
      }
    }
    return this.repo.save(lead);
  }

  /**
   * Email Guidify once when the planner (or heuristics) mark a hot lead.
   * Idempotent per session via hotLeadNotifiedAt.
   */
  async maybeNotifyHotLead(input: {
    sessionId: string;
    draft: DesignDraftPublic;
    privateQuote: PrivateQuote;
    messages: ChatMessage[];
  }): Promise<void> {
    const lead = await this.repo.findOne({ where: { sessionId: input.sessionId } });
    if (!lead || lead.hotLeadNotifiedAt) return;

    const signaled = Boolean(input.privateQuote.hotLead);
    const heuristic = looksLikeHotLead(input.draft);
    if (!signaled && !heuristic) return;

    const reason =
      input.privateQuote.hotLeadReason?.trim() ||
      (signaled
        ? 'Planner flagged hot lead'
        : 'Auto: contact + use case + discovery + sample/help ready');

    const sent = await this.mail.sendHotLeadAlert({
      sessionId: input.sessionId,
      reason,
      draft: input.draft,
      privateQuote: input.privateQuote,
      messages: input.messages,
    });
    if (!sent) return;

    lead.hotLeadNotifiedAt = new Date();
    if (!lead.privateQuote) lead.privateQuote = {};
    lead.privateQuote = {
      ...lead.privateQuote,
      hotLead: true,
      hotLeadReason: reason,
    };
    await this.repo.save(lead);
  }

  async submitQuote(input: {
    sessionId: string;
    name: string;
    email: string;
    company?: string;
    notes?: string;
    designDraft?: DesignDraftPublic | null;
    messages?: ChatMessage[];
  }): Promise<{ id: string; status: string }> {
    let lead = await this.repo.findOne({ where: { sessionId: input.sessionId } });
    if (!lead) {
      lead = this.repo.create({
        sessionId: input.sessionId,
        status: 'design',
        messages: [],
      });
    }
    lead.name = input.name.trim();
    lead.email = input.email.trim();
    lead.company = input.company?.trim() || null;
    lead.notes = input.notes?.trim() || null;
    if (input.designDraft) {
      lead.designDraft = input.designDraft as Record<string, unknown>;
    }
    if (input.messages?.length) {
      lead.messages = input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }
    lead.status = 'quoted';
    const saved = await this.repo.save(lead);
    await this.maybePostWebhook(saved);
    await this.notifyQuoteRequest(saved);
    return { id: saved.id, status: saved.status };
  }

  private async notifyQuoteRequest(lead: LeadEntity): Promise<void> {
    if (lead.quoteNotifiedAt) return;
    const draft = (lead.designDraft || null) as DesignDraftPublic | null;
    const privateQuote = {
      ...((lead.privateQuote || null) as PrivateQuote | null),
      unansweredQuestions: [
        ...new Set([
          ...((lead.privateQuote as PrivateQuote | null)?.unansweredQuestions ||
            []),
          ...(lead.unansweredQuestions || []),
        ]),
      ],
    } as PrivateQuote;
    const sent = await this.mail.sendQuoteRequest({
      sessionId: lead.sessionId,
      name: lead.name || '—',
      email: lead.email || '—',
      company: lead.company,
      notes: lead.notes,
      draft,
      privateQuote,
      messages: (lead.messages || []) as ChatMessage[],
    });
    if (!sent) return;
    lead.quoteNotifiedAt = new Date();
    await this.repo.save(lead);
  }

  /**
   * Email Guidify when a planner guest asks for a human — conversation is wrapped.
   * Idempotent per session via privateQuote.transferHumanNotifiedAt.
   */
  async notifyTransferHuman(input: {
    sessionId: string;
    draft: DesignDraftPublic;
    privateQuote?: PrivateQuote | null;
    messages: ChatMessage[];
    triggerText?: string;
  }): Promise<void> {
    const lead = await this.repo.findOne({ where: { sessionId: input.sessionId } });
    if (!lead) return;
    const prior = (lead.privateQuote || {}) as Record<string, unknown>;
    if (prior.transferHumanNotifiedAt) return;

    const privateQuote = {
      ...(input.privateQuote || (lead.privateQuote as PrivateQuote) || {}),
      unansweredQuestions: [
        ...new Set([
          ...((input.privateQuote?.unansweredQuestions || []) as string[]),
          ...(lead.unansweredQuestions || []),
        ]),
      ],
    } as PrivateQuote;

    const sent = await this.mail.sendTransferHumanAlert({
      sessionId: input.sessionId,
      draft: input.draft,
      privateQuote,
      messages: input.messages,
      triggerText: input.triggerText,
    });
    if (!sent) return;

    lead.privateQuote = {
      ...prior,
      ...privateQuote,
      transferHumanNotifiedAt: new Date().toISOString(),
      transferHumanTrigger: (input.triggerText || '').slice(0, 400),
    };
    await this.repo.save(lead);
  }

  /**
   * Leave / idle / guest exit — SUCCESS_LEAD or FAILED_LEAD by draft quality.
   * Skips if quote, transfer, or prior session-closed / hot-lead already mailed.
   */
  private async notifySessionClosed(
    lead: LeadEntity,
    closedReason: string,
  ): Promise<void> {
    if (lead.quoteNotifiedAt || lead.hotLeadNotifiedAt) return;
    const prior = (lead.privateQuote || {}) as Record<string, unknown>;
    if (prior.transferHumanNotifiedAt || prior.sessionClosedNotifiedAt) return;

    const draft = (lead.designDraft || null) as DesignDraftPublic | null;
    const privateQuote = {
      ...((lead.privateQuote || null) as PrivateQuote | null),
      unansweredQuestions: [
        ...new Set([
          ...((lead.privateQuote as PrivateQuote | null)?.unansweredQuestions ||
            []),
          ...(lead.unansweredQuestions || []),
        ]),
      ],
    } as PrivateQuote;

    const sent = await this.mail.sendSessionClosedAlert({
      sessionId: lead.sessionId,
      closedReason,
      draft,
      privateQuote,
      messages: (lead.messages || []) as ChatMessage[],
    });
    if (!sent) return;

    lead.privateQuote = {
      ...prior,
      sessionClosedNotifiedAt: new Date().toISOString(),
      sessionClosedReason: closedReason,
    };
    await this.repo.save(lead);
  }

  private async maybePostWebhook(lead: LeadEntity): Promise<void> {
    await this.mail.postLeadWebhook(lead);
  }
}

/** Strong enough draft that Guidify should look now. */
export function looksLikeHotLead(draft: DesignDraftPublic): boolean {
  const hasContact = Boolean(
    (draft.companyName || '').trim() &&
      (draft.contactEmail || '').trim() &&
      (draft.contactName || '').trim(),
  );
  const hasCase = Boolean(
    (draft.companyDoes || '').trim() && (draft.useCase || '').trim(),
  );
  const discoveryOk =
    Boolean(draft.discoveryComplete) ||
    (draft.discoveryAnswers || []).length >= 3;
  const designed =
    Boolean(draft.offerHelp) ||
    (draft.sampleConversation || []).length >= 8 ||
    ((draft.funnels || []).length > 0 &&
      (draft.integrationInterest || '').trim().length > 0);
  return hasContact && hasCase && discoveryOk && designed;
}
