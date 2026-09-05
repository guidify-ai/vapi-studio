import { Logger } from '@nestjs/common';
import type { LeadOutbound } from './lead-outbound.types';

const log = new Logger('LeadOutboundStub');

/** Public no-op — used when `src/private/lead-outbound` is absent. */
export const stubLeadOutbound: LeadOutbound = {
  async sendHotLeadAlert() {
    log.log('stub: hot-lead skipped (no private outbound)');
    return false;
  },
  async sendQuoteRequest() {
    log.log('stub: quote-request skipped (no private outbound)');
    return false;
  },
  async sendTransferHumanAlert() {
    log.log('stub: transfer-human skipped (no private outbound)');
    return false;
  },
  async sendSessionClosedAlert() {
    log.log('stub: session-closed skipped (no private outbound)');
    return false;
  },
  async postLeadWebhook() {
    log.log('stub: webhook skipped (no private outbound)');
  },
};
