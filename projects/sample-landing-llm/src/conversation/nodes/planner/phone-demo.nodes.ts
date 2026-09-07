/**
 * Sample demo flow — Greeting → 3 topics → lead gen → how heard → farewell.
 * Shared by web chat and outbound phone (old planner graph unmounted).
 */

import { Injectable } from '@nestjs/common';
import {
  AgentNode,
  CodeIntention,
  INTENTION_CASCADE_PHASE,
  INTENTION_RUN_KIND,
  STANDARD_INTENTIONS,
  type IntentionContext,
  type IntentionRunResult,
  type ListenExpectation,
  type NodeContext,
  type NodeResult,
} from '@guidify-ai/vapi-studio';
import {
  PLANNER_INTENTIONS,
  type PlannerSchema,
} from '../../planner-schema';
import { stampAnalyticsTag } from '../../../analytics/stamp-analytics-tag';
import { PLANNER_ANALYTICS_TAGS } from '../../../analytics/planner-funnels';
import { portalBoosts } from '../../lib/portal-boosts';
import { PlannerLeadMailService } from '../../../mail/planner-lead-mail.service';
import { DIDNT_QUITE_GET_IT } from '../../lib/reask-prompt';

function firstName(memory: PlannerSchema['memory']): string | undefined {
  const n = memory.contactName?.trim();
  if (!n) return undefined;
  return n.split(/\s+/)[0];
}

function softAffirmativeNoLane(text: string): boolean {
  return /^(yes|yeah|yep|yup|sure|ok|okay|fine|alright|cool|great|why not|sounds good)[.!]?\s*$/i.test(
    text.trim(),
  );
}

/** Cost / pricing topic — includes short ASR typos like "ho much". */
export function looksLikeCostTopic(userText: string): boolean {
  const t = userText.toLowerCase();
  if (
    /\b(cost|price|pricing|how much|free|expensive|cheap)\b/i.test(t) ||
    /\b(option )?two\b|\bsecond\b/.test(t)
  ) {
    return true;
  }
  // Near-misses: "ho much", "how muc", "howmuch"
  if (/\bh+o+\s*m+u+c+h*\b/.test(t) || /\bhowm+u+c+h*\b/.test(t)) {
    return true;
  }
  return false;
}

export const TOPIC_MENU =
  'We can talk about three things: one — what Vapi Studio can do; two — how much it costs; or three — how to build if you are not a developer. Which sounds useful?';

export const USE_CASE_ASK =
  'In plain language, what is the first voice module you would want — what should the agent do for callers?';

export const HEARD_ABOUT_ASK =
  'One last quick question — how did you hear about Vapi Studio?';

export function topicMenuListen(): ListenExpectation {
  return {
    intentions: [
      { name: PLANNER_INTENTIONS.phoneDemoWhat, boost: 22, priority: 12 },
      { name: PLANNER_INTENTIONS.phoneDemoCost, boost: 22, priority: 12 },
      { name: PLANNER_INTENTIONS.phoneDemoNotDev, boost: 22, priority: 12 },
      // Soft-affirmative re-ask only — keep below topic priorities so Brain
      // cannot prefer clarify over a real topic when both score above threshold.
      { name: PLANNER_INTENTIONS.phoneDemoClarify, boost: 18, priority: 8 },
      { name: STANDARD_INTENTIONS.isGoodbye, boost: 6 },
      ...portalBoosts(),
    ],
    hints: [
      'what can you do / capabilities / what is Vapi Studio → phone_demo_what',
      'cost / price / how much / free (incl. typos like ho much) → phone_demo_cost',
      'not a developer / hire / build for me → phone_demo_not_dev',
      'Soft yes/sure without a topic → phone_demo_clarify (re-ask).',
      'Unclear / off-topic → studio.isUnknownTransition (do not invent a topic).',
    ],
    resolveIntention: ({ userText }) => {
      if (softAffirmativeNoLane(userText)) {
        return PLANNER_INTENTIONS.phoneDemoClarify;
      }
      const t = userText.toLowerCase();
      if (
        /\b(what can|capabilities|what (is|does)|explain|about vapi|developer tool)\b/i.test(
          t,
        ) ||
        /\b(option )?one\b|\bfirst\b/.test(t)
      ) {
        return PLANNER_INTENTIONS.phoneDemoWhat;
      }
      if (looksLikeCostTopic(userText)) {
        return PLANNER_INTENTIONS.phoneDemoCost;
      }
      if (
        /\b(not a (dev|developer)|non[- ]?tech|hire|build (it )?for me|official team|guidify)\b/i.test(
          t,
        ) ||
        /\b(option )?three\b|\bthird\b/.test(t)
      ) {
        return PLANNER_INTENTIONS.phoneDemoNotDev;
      }
      return null;
    },
  };
}

function useCaseListen(): ListenExpectation {
  return {
    intentions: [
      { name: PLANNER_INTENTIONS.phoneDemoUseCase, boost: 20, priority: 12 },
      { name: STANDARD_INTENTIONS.isGoodbye, boost: 6 },
      ...portalBoosts(),
    ],
    hints: [
      'Substantive description of the first voice module → phone_demo_use_case.',
      'Bare yes/sure without detail → re-ask (do not store).',
    ],
    resolveIntention: ({ userText }) => {
      if (softAffirmativeNoLane(userText)) return null;
      if (userText.trim().length >= 8) {
        return PLANNER_INTENTIONS.phoneDemoUseCase;
      }
      return null;
    },
  };
}

function heardAboutListen(): ListenExpectation {
  return {
    intentions: [
      { name: PLANNER_INTENTIONS.phoneDemoHeardAbout, boost: 20, priority: 12 },
      { name: STANDARD_INTENTIONS.isGoodbye, boost: 6 },
      ...portalBoosts(),
    ],
    hints: [
      'Any source (friend, search, LinkedIn, GitHub, Vapi, Guidify, podcast, etc.) → phone_demo_heard_about.',
      'Bare yes/sure without a source → re-ask (do not store).',
    ],
    resolveIntention: ({ userText }) => {
      if (softAffirmativeNoLane(userText)) return null;
      if (userText.trim().length >= 2) {
        return PLANNER_INTENTIONS.phoneDemoHeardAbout;
      }
      return null;
    },
  };
}

/** Greeting — sample framing + three-topic menu. */
@Injectable()
export class AcknowledgeNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.plannerStarted);
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.phoneDemoStarted);
    const name = firstName(ctx.memory);
    const fullName = ctx.memory.contactName?.trim();
    const company = ctx.memory.companyName?.trim();
    const email = ctx.memory.contactEmail?.trim();
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.intakeSeeded, {
      hasName: Boolean(fullName),
      hasEmail: Boolean(email),
      hasCompany: Boolean(company),
      complete: Boolean(fullName && company && email),
    });

    // Soft re-ask after unclear pick (same node) — never the speak-first opening.
    if (ctx.intention === PLANNER_INTENTIONS.phoneDemoClarify) {
      return ctx.output.sayAndListen(
        DIDNT_QUITE_GET_IT + TOPIC_MENU,
        topicMenuListen(),
      );
    }

    const hi = name ? `Hi ${name}` : 'Hi';
    const open =
      `${hi} — I'm the Vapi Studio sample assistant. ` +
      `This is a short sample of the kind of call you can run when you set up Vapi Studio. ` +
      TOPIC_MENU;
    return ctx.output.sayAndListen(open, topicMenuListen());
  }
}

@Injectable()
export class PhoneDemoWhatNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    ctx.memory.phoneDemoTopic = 'what';
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.phoneDemoTopic, {
      topic: 'what',
    });
    return ctx.output.continueTo({
      nodeId: 'leadGen',
      text:
        'Vapi Studio is an open-source toolkit for developers: you own the call path as a graph, and the model only helps at listen boundaries — not a free-form chatbot. ' +
        'You can build it yourself, or hire the official Vapi Studio team at Guidify to ship it for you.',
    });
  }
}

@Injectable()
export class PhoneDemoCostNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    ctx.memory.phoneDemoTopic = 'cost';
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.phoneDemoTopic, {
      topic: 'cost',
    });
    return ctx.output.continueTo({
      nodeId: 'leadGen',
      text:
        'Running Vapi with Studio is cheaper than Vapi alone — our measurements show about five hundred to eight hundred times lower cost on some tools. ' +
        'Studio itself is free to self-host with your own keys — BYOK — and voice and model usage still bill through your providers.',
    });
  }
}

@Injectable()
export class PhoneDemoNotDevNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    ctx.memory.phoneDemoTopic = 'not_dev';
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.phoneDemoTopic, {
      topic: 'not_dev',
    });
    return ctx.output.continueTo({
      nodeId: 'leadGen',
      text:
        'If you are not a developer, the official Vapi Studio team can build the first module for you. ' +
        'We do not quote prices on this call — once we understand your use case, Guidify will send a quote.',
    });
  }
}

/** Capture module-1 use case → how they heard about us. */
@Injectable()
export class PhoneDemoLeadNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    if (
      ctx.intention === PLANNER_INTENTIONS.phoneDemoUseCase &&
      (ctx.userText || '').trim().length >= 8
    ) {
      const t = (ctx.userText || '').trim().slice(0, 400);
      ctx.memory.companyDoes = t;
      ctx.memory.useCase = 'qualify';
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.useCaseSet, {
        source: 'demo_lead',
        topic: ctx.memory.phoneDemoTopic,
      });
      return ctx.output.continueTo({ nodeId: 'heardAbout' });
    }

    // Soft affirmative or any other turn — one CTA: ask for the use case.
    return ctx.output.sayAndListen(USE_CASE_ASK, useCaseListen());
  }
}

/** Attribution before farewell — then lead email + close. */
@Injectable()
export class PhoneDemoHeardAboutNode extends AgentNode<PlannerSchema> {
  constructor(private readonly leadMail: PlannerLeadMailService) {
    super();
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    if (
      ctx.intention === PLANNER_INTENTIONS.phoneDemoHeardAbout &&
      (ctx.userText || '').trim().length >= 2
    ) {
      const heard = (ctx.userText || '').trim().slice(0, 200);
      ctx.memory.heardAbout = heard;
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.phoneDemoHeardAbout, {
        source: heard.slice(0, 80),
      });
      await this.leadMail.notifyPhoneDemoLead(ctx);
      return ctx.output.continueTo({ nodeId: 'farewell' });
    }

    if (ctx.intention === STANDARD_INTENTIONS.isGoodbye) {
      await this.leadMail.notifyPhoneDemoLead(ctx);
      return ctx.output.continueTo({ nodeId: 'farewell' });
    }

    return ctx.output.sayAndListen(HEARD_ABOUT_ASK, heardAboutListen());
  }
}

@Injectable()
export class PhoneDemoWhatIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.phoneDemoWhat;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 20;
  priority = 12;
  toNodeId = 'topicWhat';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (softAffirmativeNoLane(ctx.userText)) return null;
    if (
      /\b(what can|capabilities|what (is|does)|about vapi|developer tool)\b/i.test(
        ctx.userText,
      ) ||
      /\b(option )?one\b|\bfirst\b/i.test(ctx.userText)
    ) {
      return 0.9;
    }
    return null;
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'topicWhat',
      reason: 'phone_demo_what',
    };
  }
}

@Injectable()
export class PhoneDemoCostIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.phoneDemoCost;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 20;
  priority = 12;
  toNodeId = 'topicCost';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (softAffirmativeNoLane(ctx.userText)) return null;
    if (looksLikeCostTopic(ctx.userText)) {
      return 0.9;
    }
    return null;
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'topicCost',
      reason: 'phone_demo_cost',
    };
  }
}

@Injectable()
export class PhoneDemoNotDevIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.phoneDemoNotDev;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 20;
  priority = 12;
  toNodeId = 'topicNotDev';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (softAffirmativeNoLane(ctx.userText)) return null;
    if (
      /\b(not a (dev|developer)|non[- ]?tech|hire|build (it )?for me|official team)\b/i.test(
        ctx.userText,
      ) ||
      /\b(option )?three\b|\bthird\b/i.test(ctx.userText)
    ) {
      return 0.9;
    }
    return null;
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'topicNotDev',
      reason: 'phone_demo_not_dev',
    };
  }
}

@Injectable()
export class PhoneDemoClarifyIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.phoneDemoClarify;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 18;
  priority = 8;
  toNodeId = 'acknowledge';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    return softAffirmativeNoLane(ctx.userText) ? 0.92 : null;
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'acknowledge',
      reason: 'phone_demo_clarify',
    };
  }
}

@Injectable()
export class PhoneDemoUseCaseIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.phoneDemoUseCase;
  phase = INTENTION_CASCADE_PHASE.Scan;
  boost = 18;
  priority = 10;
  toNodeId = 'leadGen';
  reason = 'phone_demo_use_case';

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'leadGen',
      reason: 'phone_demo_use_case',
    };
  }
}

@Injectable()
export class PhoneDemoHeardAboutIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.phoneDemoHeardAbout;
  phase = INTENTION_CASCADE_PHASE.Scan;
  boost = 18;
  priority = 10;
  toNodeId = 'heardAbout';
  reason = 'phone_demo_heard_about';

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'heardAbout',
      reason: 'phone_demo_heard_about',
    };
  }
}
