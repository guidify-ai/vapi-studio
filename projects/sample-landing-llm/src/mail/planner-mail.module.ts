import { Global, Module } from '@nestjs/common';
import { PlannerLeadMailService } from './planner-lead-mail.service';

@Global()
@Module({
  providers: [PlannerLeadMailService],
  exports: [PlannerLeadMailService],
})
export class PlannerMailModule {}
