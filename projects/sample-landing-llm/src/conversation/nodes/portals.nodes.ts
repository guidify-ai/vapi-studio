import { Injectable } from '@nestjs/common';
import {
  AgentNode,
  STANDARD_INTENTIONS,
  type ListenExpectation,
  type NodeContext,
  type NodeResult,
} from '@guidify-ai/vapi-studio';
import type { PlannerSchema } from '../planner-schema';
import { stampAnalyticsTag } from '../../analytics/stamp-analytics-tag';
import { PLANNER_ANALYTICS_TAGS } from '../../analytics/planner-funnels';
import { portalBoosts } from '../lib/portal-boosts';
import { transferToHumanIfOpen } from '../lib/working-hours';

@Injectable()
export class GoodbyeNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.sessionEnded);
    const name = ctx.memory.contactName?.trim()?.split(/\s+/)[0];
    const thanks = name
      ? `Thanks for planning with us, ${name}. Goodbye.`
      : 'Thanks for planning with us. Goodbye.';
    return ctx.output.endCall(thanks);
  }
}

@Injectable()
export class PauseNode extends AgentNode<PlannerSchema> {
  async listen(): Promise<ListenExpectation> {
    return {
      intentions: [
        { name: 'isContinue', boost: 18 },
        { name: STANDARD_INTENTIONS.isGoodbye, boost: 10 },
        ...portalBoosts(),
      ],
      hints: ['Caller ready to resume → isContinue.'],
    };
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    return ctx.output.sayAndListen(
      'No rush — say when you are ready to continue.',
    );
  }
}

@Injectable()
export class MadNode extends AgentNode<PlannerSchema> {
  async listen(): Promise<ListenExpectation> {
    return {
      intentions: [
        { name: 'isContinue', boost: 18 },
        { name: STANDARD_INTENTIONS.isGoodbye, boost: 12 },
        { name: STANDARD_INTENTIONS.isMad, boost: 22 },
        { name: STANDARD_INTENTIONS.isTransferToHuman, boost: 20 },
      ],
      hints: [
        'One re-engage already happened — further anger → transfer.',
        'Calm continue / goodbye can leave without transferring.',
      ],
    };
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const strikes = (ctx.memory.madStrikes ?? 0) + 1;
    ctx.memory.madStrikes = strikes;
    await ctx.events.persist(ctx.runtime.conversationId, 'MAD_ENTER', {
      madStrikes: strikes,
    });
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.mad, {
      madStrikes: strikes,
    });

    if (strikes >= 2) {
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.transferHuman, {
        phase: 'mad_escalate',
      });
      return transferToHumanIfOpen(ctx, {
        reason: 'mad_portal_second_strike',
        beforeTransferSay:
          "I understand you're frustrated — let me connect you with someone who can help.",
        beforeAfterHoursSay:
          "I understand you're frustrated. I can't reach a person right now.",
      });
    }

    return ctx.output.sayAndListen(
      "I'm sorry you're dealing with this. Tell me what's going on, and I'll help — or say you'd like a person.",
    );
  }
}

@Injectable()
export class UnknownTransitionNode extends AgentNode<PlannerSchema> {
  async before(ctx: NodeContext<PlannerSchema>): Promise<boolean> {
    return ctx.intention === STANDARD_INTENTIONS.isUnknownTransition;
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.unknown);
    return ctx.output.sayAndListen(
      "Sorry — I missed that. Could you say it another way?",
      {
        intentions: [
          { name: STANDARD_INTENTIONS.isUnknownTransition, boost: 5 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 8 },
          ...portalBoosts(),
        ],
      },
    );
  }
}

@Injectable()
export class TransferToHumanNode extends AgentNode<PlannerSchema> {
  async listen(
    ctx: NodeContext<PlannerSchema>,
  ): Promise<ListenExpectation | null> {
    const attempts = ctx.runtime.portalState.transferToHuman.reengagementAttempts;
    if (attempts >= 1) return null;
    return {
      intentions: [
        { name: STANDARD_INTENTIONS.isTransferToHuman, boost: 28 },
        { name: 'isContinue', boost: 14 },
        { name: STANDARD_INTENTIONS.isGoodbye, boost: 5 },
        ...portalBoosts(),
      ],
      hints: [
        'First transfer re-engage — offer to keep helping or insist on a person.',
      ],
    };
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const portal = ctx.runtime.portalState.transferToHuman;
    if (portal.reengagementAttempts < 1) {
      portal.reengagementAttempts += 1;
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.transferHuman, {
        phase: 'ask_human',
      });
      return ctx.output.sayAndListen(
        "I can often finish the plan here — how can I help? Or say you'd still like a person.",
      );
    }

    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.transferHuman, {
      phase: 'transfer',
    });
    // Web planner: no live phone transfer — wrap with Guidify email follow-up.
    if (ctx.conversation.variables.callerChannel === 'web') {
      return ctx.output.endCall(
        "I'll have the Vapi Studio team (Guidify) email you to continue. Thanks for planning with us. Goodbye.",
      );
    }
    return transferToHumanIfOpen(ctx, {
      reason: 'portal_transfer_to_human',
      beforeTransferSay: 'Connecting you to a human now.',
    });
  }
}

@Injectable()
export class StillThereNode extends AgentNode<PlannerSchema> {
  async before(ctx: NodeContext<PlannerSchema>): Promise<boolean> {
    if (ctx.intention === STANDARD_INTENTIONS.isPositive) {
      return ctx.runtime.portalState.activePortalId === 'stillThere';
    }
    return (
      ctx.intention === STANDARD_INTENTIONS.isStillThere ||
      ctx.intention === STANDARD_INTENTIONS.isGoodbye
    );
  }

  async listen(
    ctx: NodeContext<PlannerSchema>,
  ): Promise<ListenExpectation | null> {
    if (ctx.runtime.portalState.stillThere.attempts >= 2) return null;
    return {
      intentions: [
        { name: STANDARD_INTENTIONS.isStillThere, boost: 5 },
        { name: STANDARD_INTENTIONS.isPositive, boost: 20 },
        { name: STANDARD_INTENTIONS.isGoodbye, boost: 10 },
      ],
      resolveIntention: ({ userText }) => {
        if (/\b(yes|yeah|yep|here|still|ok|okay)\b/i.test(userText)) {
          return STANDARD_INTENTIONS.isPositive;
        }
        return null;
      },
    };
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const portal = ctx.runtime.portalState.stillThere;
    portal.attempts += 1;
    if (portal.attempts >= 2) {
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.sessionEnded, {
        reason: 'still_there_timeout',
      });
      return ctx.output.endCall(
        'I will let you go — come back anytime. Goodbye.',
      );
    }
    return ctx.output.sayAndListen('Are you still there?');
  }
}
