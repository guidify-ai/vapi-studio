import {
  Controller,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AnalyticsService } from './analytics.service';
import {
  analyticsCsvFilename,
  parseAnalyticsCsvKind,
  renderAnalyticsCsv,
} from './analytics-csv';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** JSON snapshot — funnels + top tags (Studio SPA + scripts). */
  @Get('api')
  snapshotApi(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('sinceDays') sinceDays?: string,
    @Query('projectId') projectId?: string,
  ) {
    const accept = String(req.headers.accept ?? '');
    if (accept.includes('text/html') && !accept.includes('application/json')) {
      const days = sinceDays ? Number(sinceDays) : 30;
      res.redirect(302, `/analytics?sinceDays=${days}`);
      return;
    }
    return this.analytics.snapshot({
      sinceDays: sinceDays ? Number(sinceDays) : undefined,
      projectId: projectId?.trim() || undefined,
    });
  }

  /**
   * CSV export of a pre-aggregated snapshot slice.
   * `kind`: funnels | outcomes | tags | events | branches | summary | quality
   */
  @Get('export.csv')
  async exportCsv(
    @Res() res: Response,
    @Query('kind') kindRaw?: string,
    @Query('sinceDays') sinceDays?: string,
    @Query('projectId') projectId?: string,
  ): Promise<void> {
    const kind = parseAnalyticsCsvKind(kindRaw) ?? 'funnels';
    const days = Math.min(
      Math.max(sinceDays ? Number(sinceDays) : 30, 1),
      365,
    );
    const snapshot = await this.analytics.snapshot({
      sinceDays: days,
      projectId: projectId?.trim() || undefined,
    });
    const body = renderAnalyticsCsv(kind, snapshot, days);
    const filename = analyticsCsvFilename(kind, days);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(body);
  }
}
