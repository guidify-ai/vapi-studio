import { Injectable, Logger } from '@nestjs/common';
import type { LeadEntity } from '../leads/lead.entity';
import { loadLeadOutbound } from './load-lead-outbound';
import type {
  HotLeadPayload,
  LeadOutbound,
  QuoteRequestPayload,
  SessionClosedPayload,
  TransferHumanPayload,
} from './lead-outbound.types';

/**
 * Nest wrapper around private (or stub) outbound.
 * Destination addresses and API keys never appear in the public tree.
 */
@Injectable()
export class LeadOutboundService implements LeadOutbound {
  private readonly log = new Logger(LeadOutboundService.name);
  private readonly impl: LeadOutbound = loadLeadOutbound();

  async sendHotLeadAlert(input: HotLeadPayload): Promise<boolean> {
    try {
      return await this.impl.sendHotLeadAlert(input);
    } catch (err) {
      this.log.warn(`hot-lead outbound failed: ${err}`);
      return false;
    }
  }

  async sendQuoteRequest(input: QuoteRequestPayload): Promise<boolean> {
    try {
      return await this.impl.sendQuoteRequest(input);
    } catch (err) {
      this.log.warn(`quote outbound failed: ${err}`);
      return false;
    }
  }

  async sendTransferHumanAlert(input: TransferHumanPayload): Promise<boolean> {
    try {
      return await this.impl.sendTransferHumanAlert(input);
    } catch (err) {
      this.log.warn(`transfer-human outbound failed: ${err}`);
      return false;
    }
  }

  async sendSessionClosedAlert(input: SessionClosedPayload): Promise<boolean> {
    try {
      return await this.impl.sendSessionClosedAlert(input);
    } catch (err) {
      this.log.warn(`session-closed outbound failed: ${err}`);
      return false;
    }
  }

  async postLeadWebhook(lead: LeadEntity): Promise<void> {
    try {
      await this.impl.postLeadWebhook?.(lead);
    } catch (err) {
      this.log.warn(`webhook outbound failed: ${err}`);
    }
  }
}
