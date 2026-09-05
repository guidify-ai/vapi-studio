import { Injectable } from '@nestjs/common';
import {
  ConversationRepository,
  ProjectRepository,
  type AnalyticsFunnelDefinition,
} from '@guidify-ai/vapi-studio';
import { resolveProjectUuid } from '../project/project.config';
import { PLANNER_FUNNELS } from './planner-funnels';
import { aggregatePathsFromFinalStates } from './final-state-paths';
import { heuristicOutcomeFromSnapshot } from './conversation-end-analytics';

export interface FunnelStepStats {
  id: string;
  label: string;
  conversations: number;
  /** Share of project conversations in range. */
  ofTotalPct: number | null;
  /** Share of this funnel’s first step (entry). */
  ofEntryPct: number | null;
  /** Share of previous step (null when not a nested drop-off). */
  ofPrevPct: number | null;
}

export interface FunnelStats {
  id: string;
  label: string;
  description?: string;
  /**
   * Denominator for ofEntryPct / completion — all project conversations in
   * range (not the first charted step). Call start is unavoidable and omitted
   * from steps, so entry stays the full call count.
   */
  entryConversations: number;
  steps: FunnelStepStats[];
}

export interface CallQualityRatio {
  conversations: number;
  ofTotalPct: number | null;
}

export interface CallQualityStats {
  /** Ended calls used for duration percentiles. */
  durationSampleSize: number;
  /** p80 call length in seconds (ended_at − created_at). */
  p80Sec: number | null;
  /** p90 call length in seconds. */
  p90Sec: number | null;
  /** Asked for a human (transfer portal / transferred end). */
  askHuman: CallQualityRatio;
  /** Hit mad portal. */
  mad: CallQualityRatio;
  /** Hit unknown-transition recovery. */
  unknown: CallQualityRatio;
}

export interface ProjectAnalyticsSnapshot {
  project: { id: string; slug: string | null; name: string | null };
  since: string | null;
  conversations: { total: number; active: number; ended: number };
  outcomes: Array<{
    outcome: string;
    conversations: number;
    ofTotalPct: number | null;
  }>;
  callQuality: CallQualityStats;
  topBranches: Array<{
    signature: string;
    branchLabel: string;
    nodes: string[];
    conversations: number;
    ofTotalPct: number | null;
  }>;
  funnels: FunnelStats[];
  topEventTypes: Array<{
    type: string;
    conversations: number;
    events: number;
  }>;
  topAnalyticsTags: Array<{
    tag: string;
    conversations: number;
    events: number;
  }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async snapshot(input?: {
    projectId?: string;
    sinceDays?: number;
  }): Promise<ProjectAnalyticsSnapshot> {
    const projectId = (input?.projectId || resolveProjectUuid()).toLowerCase();
    const sinceDays = Math.min(Math.max(input?.sinceDays ?? 30, 1), 365);
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const project = await this.projects.findById(projectId);
    const counts = await this.conversations.countConversationsByProject({
      projectId,
      since,
    });
    const topEventTypes =
      await this.conversations.countConversationsByEventType({
        projectId,
        since,
        limit: 30,
      });
    const topAnalyticsTags =
      await this.conversations.countConversationsByAnalyticsTag({
        projectId,
        since,
        limit: 30,
      });
    const topBranchesRaw = await this.conversations.countTopConversationPaths({
      projectId,
      since,
      limit: 5,
    });
    let topBranches = topBranchesRaw;
    if (topBranches.length === 0) {
      const ended = await this.conversations.listEndedWithFinalState({
        projectId,
        since,
      });
      topBranches = aggregatePathsFromFinalStates(
        ended.map((r) => ({
          id: r.id,
          finalState: (r.finalState as Record<string, unknown> | null) ?? null,
        })),
      )
        .slice(0, 5)
        .map((b) => ({
          signature: b.signature,
          branchLabel: b.branchLabel,
          nodes: b.nodes,
          conversations: b.conversations,
        }));
    }
    const outcomeRows = await this.conversations.countConversationsByCallOutcome(
      { projectId, since },
    );
    const outcomeMap = new Map(
      outcomeRows.map((r) => [r.outcome, r.conversations]),
    );
    let outcomes = (['success', 'failure', 'unknown'] as const).map(
      (outcome) => {
        const conversations = outcomeMap.get(outcome) ?? 0;
        return {
          outcome,
          conversations,
          ofTotalPct:
            counts.total > 0
              ? Math.round((conversations / counts.total) * 1000) / 10
              : null,
        };
      },
    );
    if (outcomeRows.length === 0 && counts.ended > 0) {
      const ended = await this.conversations.listEndedWithFinalState({
        projectId,
        since,
      });
      const tallies = { success: 0, failure: 0, unknown: 0 };
      for (const row of ended) {
        const o = heuristicOutcomeFromSnapshot(
          (row.finalState as Record<string, unknown> | null) ?? null,
        );
        tallies[o] += 1;
      }
      outcomes = (['success', 'failure', 'unknown'] as const).map((outcome) => ({
        outcome,
        conversations: tallies[outcome],
        ofTotalPct:
          counts.ended > 0
            ? Math.round((tallies[outcome] / counts.ended) * 1000) / 10
            : null,
      }));
    }

    const funnels: FunnelStats[] = [];
    for (const def of PLANNER_FUNNELS) {
      funnels.push(
        await this.scoreFunnel(def, projectId, since, counts.total),
      );
    }

    const callQuality = await this.scoreCallQuality(
      projectId,
      since,
      counts.total,
    );

    return {
      project: {
        id: projectId,
        slug: project?.slug ?? null,
        name: project?.name ?? null,
      },
      since: since.toISOString(),
      conversations: counts,
      outcomes,
      callQuality,
      topBranches: topBranches.map((b) => ({
        ...b,
        ofTotalPct:
          counts.total > 0
            ? Math.round((b.conversations / counts.total) * 1000) / 10
            : null,
      })),
      funnels,
      topEventTypes,
      topAnalyticsTags,
    };
  }

  private async scoreCallQuality(
    projectId: string,
    since: Date,
    totalConversations: number,
  ): Promise<CallQualityStats> {
    const ratio = (n: number): CallQualityRatio => ({
      conversations: n,
      ofTotalPct:
        totalConversations > 0
          ? Math.round((n / totalConversations) * 1000) / 10
          : null,
    });

    const [durations, askHuman, mad, unknown] = await Promise.all([
      this.conversations.callDurationPercentiles({
        projectId,
        since,
        percentiles: [0.8, 0.9],
      }),
      this.conversations.countConversationsMatchingEventMatchers({
        projectId,
        since,
        matchers: [
          { type: 'TRANSFER_REENGAGE' },
          {
            type: 'STUDIO_END_REASON',
            payloadEquals: { reason: 'transferred_to_human' },
          },
        ],
      }),
      this.conversations.countConversationsMatchingStep({
        projectId,
        since,
        eventTypes: ['MAD_ENTER'],
        tags: ['mad'],
      }),
      this.conversations.countConversationsMatchingStep({
        projectId,
        since,
        eventTypes: ['UNKNOWN_TRANSITION'],
        tags: ['unknown'],
      }),
    ]);

    return {
      durationSampleSize: durations.sampleSize,
      p80Sec: durations.valuesSec.p80 ?? null,
      p90Sec: durations.valuesSec.p90 ?? null,
      askHuman: ratio(askHuman),
      mad: ratio(mad),
      unknown: ratio(unknown),
    };
  }

  private async scoreFunnel(
    def: AnalyticsFunnelDefinition,
    projectId: string,
    since: Date,
    totalConversations: number,
  ): Promise<FunnelStats> {
    // True entry = all calls in range. First charted step (e.g. identity) is
    // optional and must show <100% when some callers never reach it.
    const entryCount = totalConversations;
    const steps: FunnelStepStats[] = [];
    let prevCount: number | null = null;
    for (const step of def.steps) {
      const conversations =
        await this.conversations.countConversationsMatchingStep({
          projectId,
          since,
          eventTypes: step.eventTypes,
          tags: step.tags,
          requireAllTags: step.requireAllTags,
          excludeTags: step.excludeTags,
        });
      steps.push({
        id: step.id,
        label: step.label,
        conversations,
        ofTotalPct:
          totalConversations > 0
            ? Math.round((conversations / totalConversations) * 1000) / 10
            : null,
        ofEntryPct:
          entryCount > 0
            ? Math.round((conversations / entryCount) * 1000) / 10
            : null,
        ofPrevPct:
          prevCount != null &&
          prevCount > 0 &&
          conversations <= prevCount
            ? Math.round((conversations / prevCount) * 1000) / 10
            : null,
      });
      prevCount = conversations;
    }
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      entryConversations: entryCount,
      steps,
    };
  }
}
