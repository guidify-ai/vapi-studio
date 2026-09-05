import { Injectable } from '@nestjs/common';
import {
  AgentNode,
  STANDARD_INTENTIONS,
  type ListenExpectation,
  type NodeContext,
  type NodeResult,
} from '@guidify-ai/vapi-studio';
import {
  DISCOVERY_QUESTIONS,
  MAX_CORRECTIONS,
  MAX_DISCOVERY_ANSWERS,
  PLANNER_INTENTIONS,
  type PlannerSchema,
} from '../../planner-schema';
import { stampAnalyticsTag } from '../../../analytics/stamp-analytics-tag';
import { PLANNER_ANALYTICS_TAGS } from '../../../analytics/planner-funnels';
import { portalBoosts } from '../../lib/portal-boosts';
import {
  buildDesignPackage,
  formatSampleForSpeech,
} from '../../lib/build-design-package';

function firstName(memory: PlannerSchema['memory']): string | undefined {
  const n = memory.contactName?.trim();
  if (!n) return undefined;
  return n.split(/\s+/)[0];
}

function softAffirmativeNoLane(text: string): boolean {
  return /^(yeah|yep|yup|sure|ok|okay|fine|alright|why not|sounds good)[.!]?\s*$/i.test(
    text.trim(),
  );
}

/** Open — acknowledge web guest; seed contact from intake. */
@Injectable()
export class AcknowledgeNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.plannerStarted);
    const name = firstName(ctx.memory);
    const company = ctx.memory.companyName;
    const who = name
      ? company
        ? `${name} at ${company}`
        : name
      : company || 'you';
    return ctx.output.continueTo({
      nodeId: 'companyDoes',
      text: `Hi ${who} — I'm the Vapi Studio planner. We'll design the voice agent you want to build.`,
    });
  }
}

@Injectable()
export class CompanyDoesNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    if (
      ctx.intention === PLANNER_INTENTIONS.companyDoesCollected &&
      !ctx.memory.companyDoes &&
      (ctx.userText || '').trim().length >= 4
    ) {
      ctx.memory.companyDoes = (ctx.userText || '').trim().slice(0, 280);
    }
    if (ctx.memory.companyDoes) {
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.companyDoesSet);
      return ctx.output.continueTo({ nodeId: 'useCase' });
    }
    return ctx.output.sayAndListen(
      'In one plain sentence — what does your company do?',
      {
        intentions: [
          { name: PLANNER_INTENTIONS.companyDoesCollected, boost: 22 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 5 },
          ...portalBoosts(),
        ],
        hints: [
          'One sentence describing the business (roofs, HVAC, dental, SaaS, etc.).',
        ],
        resolveIntention: ({ userText }) => {
          const t = userText.trim();
          if (t.length >= 8 && !softAffirmativeNoLane(t)) {
            return PLANNER_INTENTIONS.companyDoesCollected;
          }
          return null;
        },
      },
    );
  }
}

@Injectable()
export class UseCaseNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const mapped = useCaseFromIntention(ctx.intention);
    if (mapped) {
      ctx.memory.useCase = mapped;
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.useCaseSet, {
        useCase: mapped,
      });
      return ctx.output.continueTo({ nodeId: 'discovery' });
    }
    if (ctx.memory.useCase) {
      return ctx.output.continueTo({ nodeId: 'discovery' });
    }
    if (softAffirmativeNoLane(ctx.userText || '') || ctx.intention === 'use_case_clarify') {
      return ctx.output.sayAndListen(
        'Which one — qualify, book, FAQ, dispatch, or something else?',
        useCaseListen(),
      );
    }
    return ctx.output.sayAndListen(
      'What should we try first — qualify leads, book appointments, FAQ, dispatch, or something else?',
      useCaseListen(),
    );
  }
}

function useCaseFromIntention(
  intention: string | null | undefined,
): PlannerSchema['memory']['useCase'] | null {
  if (!intention) return null;
  const map: Record<string, NonNullable<PlannerSchema['memory']['useCase']>> = {
    [PLANNER_INTENTIONS.useCaseQualify]: 'qualify',
    [PLANNER_INTENTIONS.useCaseBook]: 'book',
    [PLANNER_INTENTIONS.useCaseFaq]: 'faq',
    [PLANNER_INTENTIONS.useCaseDispatch]: 'dispatch',
    [PLANNER_INTENTIONS.useCaseOther]: 'other',
  };
  return map[intention] ?? null;
}

function useCaseListen(): ListenExpectation {
  return {
    intentions: [
      { name: PLANNER_INTENTIONS.useCaseQualify, boost: 20, priority: 10 },
      { name: PLANNER_INTENTIONS.useCaseBook, boost: 20, priority: 10 },
      { name: PLANNER_INTENTIONS.useCaseFaq, boost: 20, priority: 10 },
      { name: PLANNER_INTENTIONS.useCaseDispatch, boost: 20, priority: 10 },
      { name: PLANNER_INTENTIONS.useCaseOther, boost: 14, priority: 8 },
      { name: 'use_case_clarify', boost: 26, priority: 12 },
      { name: STANDARD_INTENTIONS.isGoodbye, boost: 5 },
      ...portalBoosts(),
    ],
    hints: [
      'Pick exactly one lane: qualify, book, FAQ, dispatch, or other.',
      'Soft affirmatives without a lane → re-ask (do not auto-pick).',
    ],
    resolveIntention: ({ userText }) => {
      if (softAffirmativeNoLane(userText)) return 'use_case_clarify';
      const t = userText.toLowerCase();
      if (/\b(qualif|screen|lead|intake)\b/.test(t)) {
        return PLANNER_INTENTIONS.useCaseQualify;
      }
      if (/\b(book|appoint|schedul|reserv)\b/.test(t)) {
        return PLANNER_INTENTIONS.useCaseBook;
      }
      if (/\b(faq|question|knowledge|info)\b/.test(t)) {
        return PLANNER_INTENTIONS.useCaseFaq;
      }
      if (/\b(dispatch|triage|route|field)\b/.test(t)) {
        return PLANNER_INTENTIONS.useCaseDispatch;
      }
      if (/\b(other|custom|something else|not sure)\b/.test(t)) {
        return PLANNER_INTENTIONS.useCaseOther;
      }
      return null;
    },
  };
}

@Injectable()
export class DiscoveryNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    // Stamp answers / proceed from this turn before asking the next question.
    if (ctx.intention === PLANNER_INTENTIONS.discoveryProceed || softProceed(ctx.userText || '')) {
      ctx.memory.discoveryComplete = true;
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.discoveryComplete, {
        answers: ctx.memory.discoveryAnswers?.length ?? 0,
      });
      return ctx.output.continueTo({ nodeId: 'integrations' });
    }
    if (
      ctx.intention === PLANNER_INTENTIONS.discoveryAnswer &&
      (ctx.userText || '').trim().length >= 4
    ) {
      const list = ctx.memory.discoveryAnswers ?? [];
      const t = (ctx.userText || '').trim().slice(0, 400);
      if (t && list[list.length - 1] !== t && list.length < MAX_DISCOVERY_ANSWERS) {
        list.push(t);
        ctx.memory.discoveryAnswers = list;
      }
      if (list.length >= 3 || list.length >= MAX_DISCOVERY_ANSWERS) {
        ctx.memory.discoveryComplete = true;
        await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.discoveryComplete, {
          answers: list.length,
        });
        return ctx.output.continueTo({ nodeId: 'integrations' });
      }
    }

    if (ctx.memory.discoveryComplete) {
      return ctx.output.continueTo({ nodeId: 'integrations' });
    }
    const answers = ctx.memory.discoveryAnswers ?? [];
    const idx = Math.min(answers.length, DISCOVERY_QUESTIONS.length - 1);
    const question = DISCOVERY_QUESTIONS[idx];
    return ctx.output.sayAndListen(question, {
      intentions: [
        { name: PLANNER_INTENTIONS.discoveryProceed, boost: 24 },
        { name: PLANNER_INTENTIONS.discoveryAnswer, boost: 18 },
        { name: PLANNER_INTENTIONS.helpBuild, boost: 10 },
        { name: STANDARD_INTENTIONS.isGoodbye, boost: 5 },
        ...portalBoosts(),
      ],
      hints: [
        'Substantive answer → discovery_answer.',
        'proceed / ready / enough / build → discovery_proceed.',
      ],
      resolveIntention: ({ userText }) => {
        if (
          /\b(proceed|ready|enough|build|go ahead|skip)\b/i.test(userText)
        ) {
          return PLANNER_INTENTIONS.discoveryProceed;
        }
        if (userText.trim().length >= 4) {
          return PLANNER_INTENTIONS.discoveryAnswer;
        }
        return null;
      },
    });
  }
}

function softProceed(text: string): boolean {
  return /\b(proceed|ready|enough|build|go ahead|skip|next|let'?s (do|go|build)|that'?s (all|enough)|looks good)\b/i.test(
    text,
  );
}

@Injectable()
export class IntegrationsNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    if (ctx.memory.discoveryComplete) {
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.discoveryComplete, {
        answers: ctx.memory.discoveryAnswers?.length ?? 0,
      });
    }
    const fromIntent = integrationFromIntention(ctx.intention);
    if (fromIntent) {
      ctx.memory.integrationInterest = fromIntent;
      return ctx.output.continueTo({ nodeId: 'designPackage' });
    }
    if (ctx.memory.integrationInterest !== undefined) {
      return ctx.output.continueTo({ nodeId: 'designPackage' });
    }
    if (softAffirmativeNoLane(ctx.userText || '')) {
      return ctx.output.sayAndListen(
        'CRM, other tools, or none yet?',
        integrationsListen(),
      );
    }
    return ctx.output.sayAndListen(
      'For the first module — any CRM or tools to connect, or none yet?',
      integrationsListen(),
    );
  }
}

function integrationFromIntention(
  intention: string | null | undefined,
): PlannerSchema['memory']['integrationInterest'] | null {
  if (intention === PLANNER_INTENTIONS.integrationsNone) return 'none';
  if (intention === PLANNER_INTENTIONS.integrationsCrm) return 'crm';
  if (intention === PLANNER_INTENTIONS.integrationsTools) return 'tools';
  return null;
}

function integrationsListen(): ListenExpectation {
  return {
    intentions: [
      { name: PLANNER_INTENTIONS.integrationsNone, boost: 20 },
      { name: PLANNER_INTENTIONS.integrationsCrm, boost: 20 },
      { name: PLANNER_INTENTIONS.integrationsTools, boost: 18 },
      ...portalBoosts(),
    ],
    hints: [
      'none / not yet → none.',
      'Salesforce, HubSpot, CRM → crm.',
      'calendar, Twilio, tools → tools.',
    ],
    resolveIntention: ({ userText }) => {
      if (softAffirmativeNoLane(userText)) return null;
      const t = userText.toLowerCase();
      if (/\b(none|no|not yet|skip|later)\b/.test(t)) {
        return PLANNER_INTENTIONS.integrationsNone;
      }
      if (/\b(crm|salesforce|hubspot|pipedrive)\b/.test(t)) {
        return PLANNER_INTENTIONS.integrationsCrm;
      }
      if (/\b(calendar|tool|twilio|zapier|integrat)\b/.test(t)) {
        return PLANNER_INTENTIONS.integrationsTools;
      }
      return null;
    },
  };
}

/** Silent build of designDraft, then show sample. */
@Injectable()
export class DesignPackageNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    if (!ctx.memory.designDraft) {
      ctx.memory.designDraft = buildDesignPackage({
        companyName: ctx.memory.companyName || 'your company',
        companyDoes: ctx.memory.companyDoes || 'serves customers',
        useCase: ctx.memory.useCase || 'other',
        discoveryAnswers: ctx.memory.discoveryAnswers ?? [],
        integrationInterest: ctx.memory.integrationInterest,
      });
    }
    return ctx.output.continueTo({ nodeId: 'showSample' });
  }
}

@Injectable()
export class ShowSampleNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const sample = formatSampleForSpeech(
      ctx.memory.designDraft?.sampleConversation || '',
    );
    ctx.memory.sampleShown = true;
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.sampleShown);
    const body = [
      "Here's a sample call for your agent:",
      '',
      sample,
      '',
      'Tell me what to change, or say Help me build it if you want Guidify to take it from here. Anything else I can help with?',
    ].join('\n');
    return ctx.output.sayAndListen(body, {
      intentions: [
        { name: PLANNER_INTENTIONS.helpBuild, boost: 24 },
        { name: PLANNER_INTENTIONS.sampleTweak, boost: 20 },
        { name: PLANNER_INTENTIONS.sampleOk, boost: 16 },
        { name: PLANNER_INTENTIONS.nothingElse, boost: 14 },
        { name: STANDARD_INTENTIONS.isGoodbye, boost: 8 },
        ...portalBoosts(),
      ],
      hints: [
        'Help me build it / hire Guidify → help_build.',
        'Change / fix / unnatural → sample_tweak.',
        'Looks good / thanks → sample_ok.',
      ],
      resolveIntention: ({ userText }) => {
        if (/help me build|hire|guidify|quote/i.test(userText)) {
          return PLANNER_INTENTIONS.helpBuild;
        }
        if (
          /\b(change|fix|tweak|wrong|unnatural|rewrite|instead)\b/i.test(
            userText,
          )
        ) {
          return PLANNER_INTENTIONS.sampleTweak;
        }
        if (
          /\b(nothing else|all set|that'?s all|no thanks|done)\b/i.test(
            userText,
          )
        ) {
          return PLANNER_INTENTIONS.nothingElse;
        }
        if (
          /\b(looks good|ok|okay|thanks|great|perfect|fine)\b/i.test(userText)
        ) {
          return PLANNER_INTENTIONS.sampleOk;
        }
        return null;
      },
    });
  }
}

@Injectable()
export class CorrectionsNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const count = ctx.memory.correctionCount ?? 0;
    if (count >= MAX_CORRECTIONS) {
      ctx.memory.offerHelp = true;
      return ctx.output.sayAndListen(
        "We'll figure out the rest while preparing your quote. Say Help me build it when you're ready. Is there anything else I can help with?",
        {
          intentions: [
            { name: PLANNER_INTENTIONS.helpBuild, boost: 24 },
            { name: PLANNER_INTENTIONS.nothingElse, boost: 14 },
            { name: STANDARD_INTENTIONS.isGoodbye, boost: 8 },
            ...portalBoosts(),
          ],
        },
      );
    }

    const feedback = (ctx.userText || '').trim().slice(0, 400);
    ctx.memory.correctionCount = count + 1;
    const prev = ctx.memory.designDraft?.sampleConversation || '';
    const note = feedback || 'make dialogue more natural';
    const lines = prev.split('\n');
    const rewritten = [
      ...lines.slice(0, 4),
      `Agent: (Updated) Addressing: ${note.slice(0, 120)}`,
      ...lines.slice(4),
    ].join('\n');
    if (ctx.memory.designDraft) {
      ctx.memory.designDraft = {
        ...ctx.memory.designDraft,
        sampleConversation: rewritten,
      };
    }
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.sampleShown, {
      correction: true,
      correctionCount: ctx.memory.correctionCount,
    });
    return ctx.output.sayAndListen(
      [
        'Updated the sample to match that feedback:',
        '',
        formatSampleForSpeech(rewritten),
        '',
        'Tell me what else to change, or say Help me build it. Is there anything else I can help with?',
      ].join('\n'),
      {
        intentions: [
          { name: PLANNER_INTENTIONS.helpBuild, boost: 24 },
          { name: PLANNER_INTENTIONS.sampleTweak, boost: 20 },
          { name: PLANNER_INTENTIONS.sampleOk, boost: 14 },
          { name: PLANNER_INTENTIONS.nothingElse, boost: 12 },
          ...portalBoosts(),
        ],
        resolveIntention: ({ userText }) => {
          if (/help me build|hire|guidify/i.test(userText)) {
            return PLANNER_INTENTIONS.helpBuild;
          }
          if (/\b(change|fix|tweak|wrong|rewrite)\b/i.test(userText)) {
            return PLANNER_INTENTIONS.sampleTweak;
          }
          if (/\b(nothing else|all set|done)\b/i.test(userText)) {
            return PLANNER_INTENTIONS.nothingElse;
          }
          if (/\b(looks good|ok|thanks|great)\b/i.test(userText)) {
            return PLANNER_INTENTIONS.sampleOk;
          }
          return PLANNER_INTENTIONS.sampleTweak;
        },
      },
    );
  }
}

@Injectable()
export class OfferHelpNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    if (
      ctx.intention === PLANNER_INTENTIONS.helpBuild ||
      /\b(help me build|hire|guidify)\b/i.test(ctx.userText || '')
    ) {
      ctx.memory.offerHelp = true;
      ctx.memory.quoteRequested = true;
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.quoteRequested);
      return ctx.output.sayAndListen(
        "Great — Guidify will follow up using the email from your intake, with this draft attached. Is there anything else I can help with?",
        {
          intentions: [
            { name: PLANNER_INTENTIONS.nothingElse, boost: 18 },
            { name: PLANNER_INTENTIONS.sampleTweak, boost: 12 },
            { name: STANDARD_INTENTIONS.isGoodbye, boost: 10 },
            ...portalBoosts(),
          ],
        },
      );
    }
    ctx.memory.offerHelp = true;
    return ctx.output.sayAndListen(
      'When you want Guidify to build it, say Help me build it. Is there anything else I can help with?',
      {
        intentions: [
          { name: PLANNER_INTENTIONS.helpBuild, boost: 22 },
          { name: PLANNER_INTENTIONS.nothingElse, boost: 16 },
          { name: PLANNER_INTENTIONS.sampleTweak, boost: 12 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 8 },
          ...portalBoosts(),
        ],
      },
    );
  }
}
