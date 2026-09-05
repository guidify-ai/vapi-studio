import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './analytics/analytics.module';
import { DesignModule } from './design/design.module';
import { LeadsModule } from './leads/leads.module';
import { LeadEntity } from './leads/lead.entity';

function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    'postgres://studio:studio@localhost:15434/sample_landing_llm'
  );
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: databaseUrl(),
      entities: [LeadEntity],
      synchronize: true,
    }),
    DesignModule,
    LeadsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
