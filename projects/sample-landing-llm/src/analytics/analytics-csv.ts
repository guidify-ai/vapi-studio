import type { ProjectAnalyticsSnapshot } from './analytics.service';

function csvCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

export type AnalyticsCsvKind =
  | 'funnels'
  | 'outcomes'
  | 'tags'
  | 'events'
  | 'branches'
  | 'summary'
  | 'quality';

export function analyticsCsvFilename(
  kind: AnalyticsCsvKind,
  sinceDays: number,
): string {
  const day = new Date().toISOString().slice(0, 10);
  return `planner-analytics-${kind}-${sinceDays}d-${day}.csv`;
}

/** Build a CSV string for one analytics slice from the server snapshot. */
export function renderAnalyticsCsv(
  kind: AnalyticsCsvKind,
  data: ProjectAnalyticsSnapshot,
  sinceDays: number,
): string {
  const projectId = data.project.id;
  const projectName = data.project.name || data.project.slug || '';
  const since = data.since ?? '';

  switch (kind) {
    case 'summary':
      return toCsv(
        [
          'project_id',
          'project_name',
          'since',
          'since_days',
          'conversations_total',
          'conversations_active',
          'conversations_ended',
        ],
        [
          [
            projectId,
            projectName,
            since,
            sinceDays,
            data.conversations.total,
            data.conversations.active,
            data.conversations.ended,
          ],
        ],
      );
    case 'quality':
      return toCsv(
        [
          'project_id',
          'since_days',
          'duration_sample_size',
          'p80_sec',
          'p90_sec',
          'ask_human_conversations',
          'ask_human_of_total_pct',
          'mad_conversations',
          'mad_of_total_pct',
          'unknown_conversations',
          'unknown_of_total_pct',
        ],
        [
          [
            projectId,
            sinceDays,
            data.callQuality.durationSampleSize,
            data.callQuality.p80Sec,
            data.callQuality.p90Sec,
            data.callQuality.askHuman.conversations,
            data.callQuality.askHuman.ofTotalPct,
            data.callQuality.mad.conversations,
            data.callQuality.mad.ofTotalPct,
            data.callQuality.unknown.conversations,
            data.callQuality.unknown.ofTotalPct,
          ],
        ],
      );
    case 'outcomes':
      return toCsv(
        [
          'project_id',
          'since_days',
          'outcome',
          'conversations',
          'of_total_pct',
        ],
        data.outcomes.map((o) => [
          projectId,
          sinceDays,
          o.outcome,
          o.conversations,
          o.ofTotalPct,
        ]),
      );
    case 'funnels':
      return toCsv(
        [
          'project_id',
          'since_days',
          'funnel_id',
          'funnel_label',
          'entry_conversations',
          'step_id',
          'step_label',
          'step_index',
          'conversations',
          'of_calls_pct',
          'of_prev_pct',
          'of_total_pct',
        ],
        data.funnels.flatMap((f) =>
          f.steps.map((s, i) => [
            projectId,
            sinceDays,
            f.id,
            f.label,
            f.entryConversations,
            s.id,
            s.label,
            i + 1,
            s.conversations,
            s.ofEntryPct,
            s.ofPrevPct,
            s.ofTotalPct,
          ]),
        ),
      );
    case 'tags':
      return toCsv(
        [
          'project_id',
          'since_days',
          'tag',
          'conversations',
          'events',
        ],
        data.topAnalyticsTags.map((t) => [
          projectId,
          sinceDays,
          t.tag,
          t.conversations,
          t.events,
        ]),
      );
    case 'events':
      return toCsv(
        [
          'project_id',
          'since_days',
          'event_type',
          'conversations',
          'events',
        ],
        data.topEventTypes.map((t) => [
          projectId,
          sinceDays,
          t.type,
          t.conversations,
          t.events,
        ]),
      );
    case 'branches':
      return toCsv(
        [
          'project_id',
          'since_days',
          'branch_label',
          'signature',
          'conversations',
          'of_total_pct',
        ],
        data.topBranches.map((b) => [
          projectId,
          sinceDays,
          b.branchLabel,
          b.signature,
          b.conversations,
          b.ofTotalPct,
        ]),
      );
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return toCsv(['error'], [['unknown kind']]);
    }
  }
}

export function parseAnalyticsCsvKind(
  raw: string | undefined,
): AnalyticsCsvKind | null {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (
    k === 'funnels' ||
    k === 'outcomes' ||
    k === 'tags' ||
    k === 'events' ||
    k === 'branches' ||
    k === 'summary' ||
    k === 'quality'
  ) {
    return k;
  }
  return null;
}
