/**
 * Outbound lead notifications — public contract only.
 * Real destinations (Resend, webhooks, inboxes) live in `src/private/` (never committed).
 */

import type { ChatMessage, DesignDraftPublic, PrivateQuote } from '../leads/design-types';
import type { LeadEntity } from '../leads/lead.entity';

export type HotLeadPayload = {
  sessionId: string;
  reason: string;
  draft: DesignDraftPublic | null;
  privateQuote: PrivateQuote | null;
  messages: ChatMessage[];
};

export type QuoteRequestPayload = {
  sessionId: string;
  name: string;
  email: string;
  company?: string | null;
  notes?: string | null;
  draft: DesignDraftPublic | null;
  privateQuote: PrivateQuote | null;
  messages: ChatMessage[];
};

export type TransferHumanPayload = {
  sessionId: string;
  draft: DesignDraftPublic | null;
  privateQuote: PrivateQuote | null;
  messages: ChatMessage[];
  /** Guest text that triggered the wrap-up. */
  triggerText?: string;
};

export type SessionClosedPayload = {
  sessionId: string;
  /** left_site | idle_timeout | guest_exit */
  closedReason: string;
  draft: DesignDraftPublic | null;
  privateQuote: PrivateQuote | null;
  messages: ChatMessage[];
};

export interface LeadOutbound {
  sendHotLeadAlert(input: HotLeadPayload): Promise<boolean>;
  sendQuoteRequest(input: QuoteRequestPayload): Promise<boolean>;
  /** Planner guest asked for a human — conversation wrapped; notify Guidify. */
  sendTransferHumanAlert(input: TransferHumanPayload): Promise<boolean>;
  /** Session closed (leave / idle / exit) — SUCCESS_LEAD or FAILED_LEAD by draft quality. */
  sendSessionClosedAlert(input: SessionClosedPayload): Promise<boolean>;
  /** Optional CRM / internal webhook. */
  postLeadWebhook?(lead: LeadEntity): Promise<void>;
}
