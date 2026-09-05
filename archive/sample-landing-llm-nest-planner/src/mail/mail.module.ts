import { Module } from '@nestjs/common';
import { LeadOutboundService } from '../integrations/lead-outbound.service';

@Module({
  providers: [LeadOutboundService],
  exports: [LeadOutboundService],
})
export class MailModule {}
