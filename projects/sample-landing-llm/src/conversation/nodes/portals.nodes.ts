import { Injectable } from '@nestjs/common';
import {
  AgentNode,
  STANDARD_INTENTIONS,
  type ListenExpectation,
  type NodeContext,
  type NodeResult,
} from '@guidify-ai/vapi-studio';
import type { PlannerSchema } from '../planner-schema';
import { PLANNER_INTENTIONS } from '../planner-schema';
import { stampAnalyticsTag } from '../../analytics/stamp-analytics-tag';
import { PLANNER_ANALYTICS_TAGS } from '../../analytics/planner-funnels';
import { portalBoosts } from '../lib/portal-boosts';
import {
  OUTBOUND_DEMO_NO_TRANSFER,
  isOutboundPhoneDemo,
} from '../lib/outbound-phone-demo';
import { looksLikeSoftContinue } from '../lib/looks-like-mad';
import { PlannerLeadMailService } from '../../mail/planner-lead-mail.service';
import {
  isAfterHoursMode,
  transferToHumanIfOpen,
} from '../lib/working-hours';
import { DIDNT_QUITE_GET_IT } from '../lib/reask-prompt';
import {
  HEARD_ABOUT_ASK,
  TOPIC_MENU,
  USE_CASE_ASK,
  topicMenuListen,
} from './planner/phone-demo.nodes';

/**
 * Escape hatch after a portal. Supervisor intercepts `isContinue` and silently
 * replays the origin listen — this Node must not speak filler.
 */
@Injectable()
export class ContinueNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const origin =
      ctx.runtime.portalState.originNodeId ??
      ctx.runtime.normalFlowNodeId ??
      ctx.previousNodeId;
    if (origin && origin !== 'continue') {
      return ctx.output.continueTo({
        nodeId: origin,
        reason: 'continue_escape_hatch',
      });
    }
    return ctx.output.sayAndListen(
      'What would you like to do next?',
      {
        intentions: [
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 8 },
          ...portalBoosts(),
        ],
      },
    );
  }
}

@Injectable()
export class GoodbyeNode extends AgentNode<PlannerSchema> {
  constructor(private readonly leadMail: PlannerLeadMailService) {
    super();
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.sessionEnded);
    // Belt: if sample was shown but early mail never landed, send now.
    if (ctx.memory.sampleShown && !ctx.memory.leadMailSuccessSent) {
      await this.leadMail.notifySampleReady(ctx);
    }
    const name = ctx.memory.contactName?.trim()?.split(/\s+/)[0];
    if (isOutboundPhoneDemo(ctx)) {
      const thanks = name
        ? `Thanks for trying this Vapi Studio sample, ${name}. The team will follow up. Goodbye.`
        : 'Thanks for trying this Vapi Studio sample. The team will follow up. Goodbye.';
      return ctx.output.endCall(thanks);
    }
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
  constructor(private readonly leadMail: PlannerLeadMailService) {
    super();
  }

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
      if (isOutboundPhoneDemo(ctx)) {
        await this.leadMail.notifyTransferHuman(ctx);
        await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.transferHuman, {
          phase: 'outbound_demo_blocked',
        });
        return ctx.output.endCall(OUTBOUND_DEMO_NO_TRANSFER);
      }
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

    if (isOutboundPhoneDemo(ctx)) {
      return ctx.output.sayAndListen(
        "I'm sorry — let's keep this short. Which topic helps: what we can do, cost, or building without being a developer?",
      );
    }

    return ctx.output.sayAndListen(
      "I'm sorry you're dealing with this. Tell me what's going on, and I'll help — or say you'd like a person.",
    );
  }
}

@Injectable()
export class UnknownTransitionNode extends AgentNode<PlannerSchema> {
  async before(_ctx: NodeContext<PlannerSchema>): Promise<boolean> {
    // Allow Force/goto entry (studio.goto.unknownTransition) as well as listen hits.
    return true;
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.unknown);
    const origin =
      ctx.runtime.portalState.originNodeId ??
      ctx.runtime.normalFlowNodeId ??
      '';

    if (origin === 'acknowledge' || origin === 'topicWhat' || origin === 'topicCost' || origin === 'topicNotDev') {
      const menu = topicMenuListen();
      return ctx.output.sayAndListen(DIDNT_QUITE_GET_IT + TOPIC_MENU, {
        ...menu,
        intentions: [
          ...(menu.intentions ?? []),
          { name: 'isContinue', boost: 6 },
          { name: STANDARD_INTENTIONS.isUnknownTransition, boost: 5 },
        ],
        note: 'Unknown recovery — topic menu',
      });
    }

    if (origin === 'leadGen') {
      return ctx.output.sayAndListen(DIDNT_QUITE_GET_IT + USE_CASE_ASK, {
        intentions: [
          { name: PLANNER_INTENTIONS.phoneDemoUseCase, boost: 20, priority: 12 },
          { name: 'isContinue', boost: 6 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 6 },
          { name: STANDARD_INTENTIONS.isUnknownTransition, boost: 5 },
          ...portalBoosts(),
        ],
        hints: [
          'Substantive description of the first voice module → phone_demo_use_case.',
        ],
        resolveIntention: ({ userText }) => {
          if (looksLikeSoftContinue(userText)) return 'isContinue';
          if (userText.trim().length >= 8) {
            return PLANNER_INTENTIONS.phoneDemoUseCase;
          }
          return null;
        },
        note: 'Unknown recovery — use case',
      });
    }

    if (origin === 'heardAbout') {
      return ctx.output.sayAndListen(DIDNT_QUITE_GET_IT + HEARD_ABOUT_ASK, {
        intentions: [
          {
            name: PLANNER_INTENTIONS.phoneDemoHeardAbout,
            boost: 20,
            priority: 12,
          },
          { name: 'isContinue', boost: 6 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 6 },
          { name: STANDARD_INTENTIONS.isUnknownTransition, boost: 5 },
          ...portalBoosts(),
        ],
        hints: [
          'Any source (friend, search, LinkedIn, GitHub, Vapi, etc.) → phone_demo_heard_about.',
        ],
        resolveIntention: ({ userText }) => {
          if (looksLikeSoftContinue(userText)) return 'isContinue';
          if (userText.trim().length >= 2) {
            return PLANNER_INTENTIONS.phoneDemoHeardAbout;
          }
          return null;
        },
        note: 'Unknown recovery — heard about',
      });
    }

    return ctx.output.sayAndListen(
      DIDNT_QUITE_GET_IT + 'Could you say that again?',
      {
        intentions: [
          { name: 'isContinue', boost: 16 },
          { name: STANDARD_INTENTIONS.isUnknownTransition, boost: 5 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 8 },
          ...portalBoosts(),
        ],
        resolveIntention: ({ userText }) => {
          if (looksLikeSoftContinue(userText)) return 'isContinue';
          return null;
        },
      },
    );
  }
}

@Injectable()
export class TransferToHumanNode extends AgentNode<PlannerSchema> {
  constructor(private readonly leadMail: PlannerLeadMailService) {
    super();
  }

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
      if (isOutboundPhoneDemo(ctx)) {
        return ctx.output.sayAndListen(
          "I can finish this sample here — which topic helps: what we can do, cost, or building without being a developer? Or say goodbye.",
        );
      }
      return ctx.output.sayAndListen(
        "I can often finish the plan here — how can I help? Or say you'd still like a person.",
      );
    }

    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.transferHuman, {
      phase: 'transfer',
    });

    // Outbound phone demo — never live-transfer.
    if (isOutboundPhoneDemo(ctx)) {
      await this.leadMail.notifyTransferHuman(ctx);
      return ctx.output.endCall(OUTBOUND_DEMO_NO_TRANSFER);
    }

    // After-hours Studio preset — block human path (web or phone).
    if (isAfterHoursMode(ctx.conversation.variables)) {
      return transferToHumanIfOpen(ctx, {
        reason: 'portal_transfer_after_hours',
      });
    }
    // Web planner (business hours): no live phone transfer — Guidify email follow-up.
    if (ctx.conversation.variables.callerChannel === 'web') {
      await this.leadMail.notifyTransferHuman(ctx);
      return ctx.output.endCall(
        "I'll have the Vapi Studio team (Guidify) email you to continue. Thanks for planning with us. Goodbye.",
      );
    }
    await this.leadMail.notifyTransferHuman(ctx);
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
