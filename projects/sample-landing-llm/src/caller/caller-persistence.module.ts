import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallerProfileEntity } from './caller-profile.entity';
import { CallerProfileService } from './caller-profile.service';

/** App-owned CRM persistence — injectable into Studio entry / Nodes. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CallerProfileEntity])],
  providers: [CallerProfileService],
  exports: [CallerProfileService, TypeOrmModule],
})
export class CallerPersistenceModule {}
