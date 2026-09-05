import { Controller, Get, Header, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { renderSampleAnalyticsPage } from './analytics-page.render';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('api')
  snapshotApi(@Query('sinceDays') sinceDays?: string) {
    return this.analytics.snapshot(sinceDays ? Number(sinceDays) : 30);
  }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async page(@Query('sinceDays') sinceDays?: string): Promise<string> {
    const snap = await this.analytics.snapshot(
      sinceDays ? Number(sinceDays) : 30,
    );
    return renderSampleAnalyticsPage(snap);
  }
}
