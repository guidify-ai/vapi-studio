import type {
  ListenExpectation,
  NodeContext,
  NodeResult,
} from '@guidify-ai/vapi-studio';
import type { PlannerSchema } from '../planner-schema';
import { portalBoosts } from './portal-boosts';

/** Spoken when a transfer is requested outside working hours. */
export const AFTER_HOURS_TRANSFER_MESSAGE =
  "I'm sorry — we're currently outside of working hours, so I can't connect you with a person right now. Please try again during business hours, or tell me if there's something else I can help with.";

export const TRANSFER_EVENTS = {
  BLOCKED_AFTER_HOURS: 'TRANSFER_BLOCKED_AFTER_HOURS',
  EXECUTE: 'TRANSFER_EXECUTE',
} as const;

export function isAfterHoursMode(
  variables: { afterHours?: boolean } | null | undefined,
): boolean {
  return variables?.afterHours === true;
}

function afterHoursListen(): ListenExpectation {
  return {
    intentions: [
      { name: 'isContinue', boost: 12 },
      ...portalBoosts(),
    ],
    hints: [
      'Transfer blocked after hours — caller may continue planning or goodbye.',
    ],
  };
}

/**
 * Transfer to a human only during working hours.
 * After hours: persist analytics, speak the block message, keep listening.
 */
export async function transferToHumanIfOpen(
  ctx: NodeContext<PlannerSchema>,
  input: {
    reason: string;
    beforeTransferSay?: string;
    beforeAfterHoursSay?: string;
    destination?: string;
    eventType?: string;
    eventPayload?: Record<string, unknown>;
  },
): Promise<NodeResult> {
  const afterHours = isAfterHoursMode(ctx.conversation.variables);
  const destination =
    input.destination ?? process.env.VAPI_TRANSFER_DESTINATION;

  if (afterHours) {
    if (input.beforeAfterHoursSay) {
      await ctx.output.say(input.beforeAfterHoursSay);
    }
    await ctx.events.persist(
      ctx.runtime.conversationId,
      TRANSFER_EVENTS.BLOCKED_AFTER_HOURS,
      {
        reason: input.reason,
        afterHours: true,
        ...(input.eventPayload ?? {}),
      },
    );
    return ctx.output.sayAndListen(
      AFTER_HOURS_TRANSFER_MESSAGE,
      afterHoursListen(),
    );
  }

  if (input.beforeTransferSay) {
    await ctx.output.say(input.beforeTransferSay);
  }

  await ctx.events.persist(
    ctx.runtime.conversationId,
    input.eventType ?? TRANSFER_EVENTS.EXECUTE,
    {
      reason: input.reason,
      destination: destination ?? null,
      ...(input.eventPayload ?? {}),
    },
  );

  if (!destination) {
    return ctx.output.endCall(
      "I'll have the Vapi Studio team follow up by email. Thanks for planning with us. Goodbye.",
    );
  }

  return ctx.output.transferToHuman(destination);
}
