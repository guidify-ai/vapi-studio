import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { LeadEntity } from '../leads/lead.entity';

export type SampleAnalyticsSnapshot = {
  project: { slug: string; name: string; port: number };
  sinceDays: number;
  conversations: {
    total: number;
    active: number;
    completed: number;
    quoted: number;
  };
  completedReasons: Array<{ reason: string; count: number; ofTotalPct: number }>;
  statuses: Array<{ status: string; count: number; ofTotalPct: number }>;
  drafts: {
    withFunnels: number;
    withSample: number;
    withUseCase: number;
  };
  topCompanies: Array<{ company: string; count: number }>;
  topUseCases: Array<{ useCase: string; count: number }>;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
  ) {}

  async snapshot(sinceDays = 30): Promise<SampleAnalyticsSnapshot> {
    const days = Math.min(Math.max(sinceDays, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.leads.find({
      where: { createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
      take: 5000,
    });
    const total = rows.length;
    const pct = (n: number) =>
      total ? Math.round((n / total) * 1000) / 10 : 0;

    const byReason = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const byCompany = new Map<string, number>();
    const byUseCase = new Map<string, number>();
    let withFunnels = 0;
    let withSample = 0;
    let withUseCase = 0;
    let active = 0;
    let completed = 0;
    let quoted = 0;

    for (const row of rows) {
      byStatus.set(row.status, (byStatus.get(row.status) || 0) + 1);
      if (row.status === 'design' && !row.completedAt) active += 1;
      if (row.status === 'completed' || row.completedAt) completed += 1;
      if (row.status === 'quoted') quoted += 1;

      const reason = row.completedReason || (row.status === 'quoted' ? 'quoted' : 'open');
      byReason.set(reason, (byReason.get(reason) || 0) + 1);

      const company = (row.company || '').trim() || '(none)';
      byCompany.set(company, (byCompany.get(company) || 0) + 1);

      const draft = (row.designDraft || {}) as Record<string, unknown>;
      const funnels = draft.funnels;
      const sample = draft.sampleConversation;
      const useCase = String(draft.useCase || draft.spokenBrand || '').trim();
      if (Array.isArray(funnels) && funnels.length) withFunnels += 1;
      if (Array.isArray(sample) && sample.length) withSample += 1;
      if (useCase) {
        withUseCase += 1;
        byUseCase.set(useCase, (byUseCase.get(useCase) || 0) + 1);
      }
    }

    const sortCount = (a: { count: number }, b: { count: number }) =>
      b.count - a.count;

    return {
      project: {
        slug: 'sample-landing-llm',
        name: 'Sample landing LLM',
        port: Number(process.env.PORT || 9998),
      },
      sinceDays: days,
      conversations: { total, active, completed, quoted },
      completedReasons: [...byReason.entries()]
        .map(([reason, count]) => ({
          reason,
          count,
          ofTotalPct: pct(count),
        }))
        .sort(sortCount),
      statuses: [...byStatus.entries()]
        .map(([status, count]) => ({
          status,
          count,
          ofTotalPct: pct(count),
        }))
        .sort(sortCount),
      drafts: { withFunnels, withSample, withUseCase },
      topCompanies: [...byCompany.entries()]
        .map(([company, count]) => ({ company, count }))
        .sort(sortCount)
        .slice(0, 12),
      topUseCases: [...byUseCase.entries()]
        .map(([useCase, count]) => ({ useCase, count }))
        .sort(sortCount)
        .slice(0, 12),
    };
  }
}
