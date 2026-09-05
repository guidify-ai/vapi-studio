import { Injectable } from '@nestjs/common';
import {
  EventService,
  type ConversationEntryInput,
  type ConversationEntryPoint,
  type ConversationHookContext,
} from '@guidify-ai/vapi-studio';
import { resolveCaller } from '../caller/caller-identity';
import { finalizeConversationAnalytics } from '../analytics/conversation-end-analytics';
import { resolveFeatureFlags } from './lib/feature-flags';
import type { PlannerSchema, PlannerVariables } from './planner-schema';

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

function metadataFeatureFlags(
  metadata: Record<string, unknown> | undefined,
): Record<string, boolean> | undefined {
  const bag = metadata?.featureFlags;
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return undefined;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(bag as Record<string, unknown>)) {
    out[k] = v === true;
  }
  return out;
}

/**
 * Seeds planner variables from Studio / landing metadata.
 * Contact fields come from the LP intake form (not re-asked in chat).
 */
@Injectable()
export class PlannerConversationEntry
  implements ConversationEntryPoint<PlannerVariables>
{
  constructor(private readonly events: EventService) {}

  createVariables(input: ConversationEntryInput): PlannerVariables {
    const caller = resolveCaller(input.metadata);
    const meta = input.metadata ?? {};
    return {
      companyName: process.env.POC_COMPANY_NAME?.trim() || 'Vapi Studio',
      afterHours: meta.afterHours === true,
      featureFlags: resolveFeatureFlags(metadataFeatureFlags(meta)),
      contactName: str(meta.contactName),
      contactEmail: str(meta.contactEmail),
      guestCompanyName: str(meta.guestCompanyName) || str(meta.companyName),
      ...(caller
        ? { callerChannel: caller.channel, callerId: caller.id }
        : {}),
    };
  }

  async beforeEach(
    ctx: ConversationHookContext<PlannerVariables>,
  ): Promise<void> {
    const memory = ctx.runtime.memory as PlannerSchema['memory'];
    if (ctx.variables.guestCompanyName && !memory.companyName) {
      memory.companyName = ctx.variables.guestCompanyName;
    }
    if (ctx.variables.contactName && !memory.contactName) {
      memory.contactName = ctx.variables.contactName;
    }
    if (ctx.variables.contactEmail && !memory.contactEmail) {
      memory.contactEmail = ctx.variables.contactEmail;
    }
  }

  async afterEach(
    ctx: ConversationHookContext<PlannerVariables>,
  ): Promise<void> {
    await finalizeConversationAnalytics(ctx, this.events);
  }
}
