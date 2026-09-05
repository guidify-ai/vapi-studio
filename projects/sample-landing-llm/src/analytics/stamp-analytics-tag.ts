import type { NodeContext } from '@guidify-ai/vapi-studio';
import type { PlannerSchema } from '../conversation/planner-schema';

export type StampAnalyticsOptions = {
  label?: string;
  [key: string]: unknown;
};

/**
 * Stamp a durable ANALYTICS_TAG.
 * Funnel charts score via the code catalog (`PLANNER_FUNNELS`) — do not pass `funnels`.
 */
export async function stampAnalyticsTag(
  ctx: NodeContext<PlannerSchema>,
  tag: string,
  payload: StampAnalyticsOptions = {},
): Promise<void> {
  const clean = tag.trim();
  if (!clean) return;
  await ctx.events.persistAnalyticsTag(
    ctx.runtime.conversationId,
    clean,
    payload,
  );
}
