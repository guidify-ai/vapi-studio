import { Module } from '@nestjs/common';
import { DesignController } from './design.controller';
import { DesignService } from './design.service';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [LeadsModule],
  controllers: [DesignController],
  providers: [DesignService],
})
export class DesignModule {}
