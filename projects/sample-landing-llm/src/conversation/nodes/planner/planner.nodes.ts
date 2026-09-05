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
  sampleRevealMessage,
} from '../../lib/build-design-package';
import {
  looksLikeKnowledgeQuestion,
  matchKnowledge,
} from '../../lib/planner-knowledge';
import { looksLikeMad, looksLikeSoftContinue } from '../../lib/looks-like-mad';
import { looksLikeSatisfiedClose, looksLikeSamplePraise } from '../../lib/satisfied-close';
import {
  FF_SAMPLE_SCOPE_HINT,
  SAMPLE_SCOPE_HINT_LINE,
  isFeatureEnabled,
} from '../../lib/feature-flags';
import { PlannerLeadMailService } from '../../../mail/planner-lead-mail.service';

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

/** Open — accept LP intake (name / email / company) as starting data; never re-ask. */
@Injectable()
export class AcknowledgeNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.plannerStarted);
    const name = firstName(ctx.memory);
    const fullName = ctx.memory.contactName?.trim();
    const company = ctx.memory.companyName?.trim();
    const email = ctx.memory.contactEmail?.trim();
    const hasIntake = Boolean(fullName && company && email);

    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.intakeSeeded, {
      hasName: Boolean(fullName),
      hasEmail: Boolean(email),
      hasCompany: Boolean(company),
      complete: hasIntake,
    });

    const who = name
      ? company
        ? `${name} at ${company}`
        : name
      : company || 'you';

    const text = hasIntake
      ? `Hi ${who} — thanks for the intro; I've got ${email} for follow-up. I'm the Vapi Studio planner. We'll design the voice agent you want to build.`
      : `Hi ${who} — I'm the Vapi Studio planner. We'll design the voice agent you want to build.`;

    return ctx.output.continueTo({
      nodeId: 'companyDoes',
      text,
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
    if (looksLikeSoftContinue(ctx.userText || '')) {
      return ctx.output.sayAndListen(
        'What should we try first — qualify leads, book appointments, FAQ, dispatch, or something else?',
        useCaseListen(),
      );
    }

    const kb = knowledgeReply(ctx.userText || '');
    if (kb) {
      return ctx.output.sayAndListen(
        `${kb} What should we try first — qualify leads, book appointments, FAQ, dispatch, or something else?`,
        useCaseListen(),
      );
    }

    // Vague use case → propose one concrete default (Nest doctrine).
    if (
      !ctx.memory.useCase &&
      !looksLikeSoftContinue(ctx.userText || '') &&
      /\b(not sure|maybe|voice ai|something with (ai|voice)|whatever|idk|i don't know)\b/i.test(
        ctx.userText || '',
      )
    ) {
      ctx.memory.useCase = 'qualify';
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.useCaseSet, {
        useCase: 'qualify',
        proposedDefault: true,
      });
      return ctx.output.continueTo({
        nodeId: 'discovery',
        text: "Let's start with qualifying website leads — a common first module. I'll ask a few short questions.",
      });
    }

    const mapped =
      ctx.intention === 'use_case_vague'
        ? ('qualify' as const)
        : useCaseFromIntention(ctx.intention);
    if (mapped) {
      ctx.memory.useCase = mapped;
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.useCaseSet, {
        useCase: mapped,
        ...(ctx.intention === 'use_case_vague'
          ? { proposedDefault: true }
          : {}),
      });
      return ctx.output.continueTo({
        nodeId: 'discovery',
        ...(ctx.intention === 'use_case_vague'
          ? {
              text: "Let's start with qualifying website leads — a common first module. I'll ask a few short questions.",
            }
          : {}),
      });
    }
    if (ctx.memory.useCase) {
      return ctx.output.continueTo({ nodeId: 'discovery' });
    }
    if (
      softAffirmativeNoLane(ctx.userText || '') ||
      ctx.intention === 'use_case_clarify'
    ) {
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

function knowledgeReply(userText: string): string | null {
  if (!looksLikeKnowledgeQuestion(userText)) return null;
  // Prefer strong hits; fall back to single-keyword when the ask already looks like FAQ.
  return (
    matchKnowledge(userText)?.answer ?? matchKnowledge(userText, 1)?.answer ?? null
  );
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
      { name: 'use_case_vague', boost: 28, priority: 14 },
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
      if (/\b(other|custom|something else)\b/.test(t)) {
        return PLANNER_INTENTIONS.useCaseOther;
      }
      if (/\b(not sure|maybe|voice ai|whatever|idk|i don't know)\b/.test(t)) {
        return 'use_case_vague';
      }
      return null;
    },
  };
}

@Injectable()
export class DiscoveryNode extends AgentNode<PlannerSchema> {
  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const answers = ctx.memory.discoveryAnswers ?? [];
    const idx = Math.min(answers.length, DISCOVERY_QUESTIONS.length - 1);
    const currentQuestion = DISCOVERY_QUESTIONS[idx];

    // Portal soft-continue replay — re-ask the same CTA; never proceed/store.
    if (looksLikeSoftContinue(ctx.userText || '')) {
      return ctx.output.sayAndListen(currentQuestion, {
        intentions: [
          { name: PLANNER_INTENTIONS.discoveryProceed, boost: 24 },
          { name: PLANNER_INTENTIONS.discoveryAnswer, boost: 18 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 5 },
          ...portalBoosts(),
        ],
        resolveIntention: discoveryResolve,
      });
    }

    const kb = knowledgeReply(ctx.userText || '');
    if (kb) {
      return ctx.output.sayAndListen(`${kb} ${currentQuestion}`, {
        intentions: [
          { name: PLANNER_INTENTIONS.discoveryProceed, boost: 24 },
          { name: PLANNER_INTENTIONS.discoveryAnswer, boost: 18 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 5 },
          ...portalBoosts(),
        ],
        resolveIntention: discoveryResolve,
      });
    }

    // Stamp answers / proceed from this turn before asking the next question.
    if (
      ctx.intention === PLANNER_INTENTIONS.discoveryProceed ||
      softProceed(ctx.userText || '')
    ) {
      ctx.memory.discoveryComplete = true;
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.discoveryComplete, {
        answers: ctx.memory.discoveryAnswers?.length ?? 0,
      });
      return ctx.output.continueTo({ nodeId: 'integrations' });
    }
    if (
      ctx.intention === PLANNER_INTENTIONS.discoveryAnswer &&
      (ctx.userText || '').trim().length >= 4 &&
      !looksLikeKnowledgeQuestion(ctx.userText || '') &&
      !looksLikeMad(ctx.userText || '')
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
    const nextAnswers = ctx.memory.discoveryAnswers ?? [];
    const nextIdx = Math.min(nextAnswers.length, DISCOVERY_QUESTIONS.length - 1);
    const question = DISCOVERY_QUESTIONS[nextIdx];
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
        'Product FAQ → answer from knowledge; do not append to discoveryAnswers.',
      ],
      resolveIntention: discoveryResolve,
    });
  }
}

function discoveryResolve({ userText }: { userText: string }): string | null {
  if (looksLikeMad(userText)) return null;
  if (looksLikeSoftContinue(userText)) return null;
  if (looksLikeKnowledgeQuestion(userText)) return null;
  if (/\b(proceed|ready|enough|build|go ahead|skip)\b/i.test(userText)) {
    return PLANNER_INTENTIONS.discoveryProceed;
  }
  if (userText.trim().length >= 4) {
    return PLANNER_INTENTIONS.discoveryAnswer;
  }
  return null;
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
  constructor(private readonly leadMail: PlannerLeadMailService) {
    super();
  }

  async before(ctx: NodeContext<PlannerSchema>): Promise<boolean> {
    // product_faq only after a sample exists; otherwise always allow entry
    // (designPackage continueTo must not 500 on before()).
    if (ctx.intention === PLANNER_INTENTIONS.productFaq) {
      return ctx.memory.sampleShown === true;
    }
    return true;
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const kb = knowledgeReply(ctx.userText || '');
    const sample = formatSampleForSpeech(
      ctx.memory.designDraft?.sampleConversation || '',
    );
    const alreadyShown = ctx.memory.sampleShown === true;
    ctx.memory.sampleShown = true;
    if (!alreadyShown) {
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.sampleShown);
      // Early hot-lead mail — do not wait for goodbye.
      await this.leadMail.notifySampleReady(ctx);
    }
    const body = kb
      ? `${kb}\n\nTell me what to change, or say Help me build it. Is there anything else I can help with?`
      : alreadyShown
        ? 'Tell me what to change, or say Help me build it. Is there anything else I can help with?'
        : sampleRevealMessage(sample, {
            scopeHint: isFeatureEnabled(
              ctx.conversation.variables.featureFlags,
              FF_SAMPLE_SCOPE_HINT,
            )
              ? SAMPLE_SCOPE_HINT_LINE
              : undefined,
          });
    // soft none / empty re-entry uses the alreadyShown CTA without replaying the sample
    if (
      alreadyShown &&
      !kb &&
      /^(none|no|nope|not really|nah)[.!]?\s*$/i.test(
        (ctx.userText || '').trim(),
      )
    ) {
      return ctx.output.sayAndListen(
        'No problem — tell me what to change, or say Help me build it. Is there anything else I can help with?',
        showSampleListen(),
      );
    }
    return ctx.output.sayAndListen(body, showSampleListen());
  }
}

function showSampleListen(): ListenExpectation {
  return {
    intentions: [
      { name: PLANNER_INTENTIONS.productFaq, boost: 26, priority: 16 },
      { name: PLANNER_INTENTIONS.helpBuild, boost: 24 },
      { name: PLANNER_INTENTIONS.nothingElse, boost: 22 },
      { name: PLANNER_INTENTIONS.sampleTweak, boost: 20 },
      { name: PLANNER_INTENTIONS.sampleOk, boost: 16 },
      { name: STANDARD_INTENTIONS.isGoodbye, boost: 8 },
      ...portalBoosts(),
    ],
    hints: [
      'Help me build it / hire Guidify → help_build.',
      'Change / fix / unnatural → sample_tweak.',
      'Looks good / thanks → sample_ok.',
      'Product FAQ → product_faq (stay on sample; do not restart intake).',
    ],
    resolveIntention: ({ userText }) => {
      if (/^(none|no|nope|not really|nah)[.!]?\s*$/i.test(userText.trim())) {
        return null;
      }
      if (looksLikeSatisfiedClose(userText)) {
        return PLANNER_INTENTIONS.nothingElse;
      }
      if (looksLikeSamplePraise(userText)) {
        return PLANNER_INTENTIONS.sampleOk;
      }
      if (looksLikeKnowledgeQuestion(userText)) {
        return PLANNER_INTENTIONS.productFaq;
      }
      if (
        /\b(help me build|hire (you|guidify)|get a quote|request a quote)\b/i.test(
          userText,
        )
      ) {
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
        /\b(looks good|ok|okay|thanks|great|perfect|fine)\b/i.test(userText)
      ) {
        return PLANNER_INTENTIONS.sampleOk;
      }
      return null;
    },
  };
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
    ctx.memory.designDraft = buildDesignPackage({
      companyName: ctx.memory.companyName || 'your company',
      companyDoes: ctx.memory.companyDoes || 'serves customers',
      useCase: ctx.memory.useCase || 'other',
      discoveryAnswers: ctx.memory.discoveryAnswers ?? [],
      integrationInterest: ctx.memory.integrationInterest,
      correctionHint: feedback,
    });
    const rewritten =
      ctx.memory.designDraft.sampleConversation || '';
    await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.sampleShown, {
      correction: true,
      correctionCount: ctx.memory.correctionCount,
    });
    return ctx.output.sayAndListen(
      [
        'Updated the sample to match that feedback.',
        '',
        formatSampleForSpeech(rewritten),
        '',
        'Tell me what else to change, or say Help me build it. Is there anything else I can help with?',
      ].join('\n'),
      {
        intentions: [
          { name: PLANNER_INTENTIONS.helpBuild, boost: 24 },
          { name: PLANNER_INTENTIONS.nothingElse, boost: 22 },
          { name: PLANNER_INTENTIONS.sampleTweak, boost: 20 },
          { name: PLANNER_INTENTIONS.sampleOk, boost: 14 },
          ...portalBoosts(),
        ],
        resolveIntention: ({ userText }) => {
          if (looksLikeSatisfiedClose(userText)) {
            return PLANNER_INTENTIONS.nothingElse;
          }
          if (looksLikeSamplePraise(userText)) {
            return PLANNER_INTENTIONS.sampleOk;
          }
          if (looksLikeKnowledgeQuestion(userText)) {
            return PLANNER_INTENTIONS.productFaq;
          }
          if (
            /\b(help me build|hire (you|guidify)|get a quote|request a quote)\b/i.test(
              userText,
            )
          ) {
            return PLANNER_INTENTIONS.helpBuild;
          }
          if (/\b(change|fix|tweak|wrong|rewrite|unnatural)\b/i.test(userText)) {
            return PLANNER_INTENTIONS.sampleTweak;
          }
          if (/\b(looks good|ok|thanks|great)\b/i.test(userText)) {
            return PLANNER_INTENTIONS.sampleOk;
          }
          // Never default to sample_tweak — that rewrote “No, all good”.
          return null;
        },
      },
    );
  }
}

@Injectable()
export class OfferHelpNode extends AgentNode<PlannerSchema> {
  constructor(private readonly leadMail: PlannerLeadMailService) {
    super();
  }

  async run(ctx: NodeContext<PlannerSchema>): Promise<NodeResult> {
    const kb = knowledgeReply(ctx.userText || '');
    if (kb && ctx.intention !== PLANNER_INTENTIONS.helpBuild) {
      return ctx.output.sayAndListen(
        `${kb}\n\nWhen you want Guidify to build it, say Help me build it. Is there anything else I can help with?`,
        offerHelpListen(),
      );
    }
    const hire =
      ctx.intention === PLANNER_INTENTIONS.helpBuild ||
      /\b(help me build|hire (you|guidify)|get a quote|request a quote)\b/i.test(
        ctx.userText || '',
      );
    if (hire) {
      ctx.memory.offerHelp = true;
      ctx.memory.quoteRequested = true;
      await stampAnalyticsTag(ctx, PLANNER_ANALYTICS_TAGS.quoteRequested);
      await this.leadMail.notifyQuoteRequested(ctx);
      const email = ctx.memory.contactEmail?.trim();
      const followUp = email
        ? `Great — Guidify will follow up at ${email}, with this draft attached. Is there anything else I can help with?`
        : "Great — Guidify will follow up using the email from your intake, with this draft attached. Is there anything else I can help with?";
      return ctx.output.sayAndListen(followUp, {
        intentions: [
          { name: PLANNER_INTENTIONS.productFaq, boost: 24 },
          { name: PLANNER_INTENTIONS.nothingElse, boost: 18 },
          { name: PLANNER_INTENTIONS.sampleTweak, boost: 12 },
          { name: STANDARD_INTENTIONS.isGoodbye, boost: 10 },
          ...portalBoosts(),
        ],
        resolveIntention: ({ userText }) => {
          if (looksLikeSatisfiedClose(userText)) {
            return PLANNER_INTENTIONS.nothingElse;
          }
          if (looksLikeKnowledgeQuestion(userText)) {
            return PLANNER_INTENTIONS.productFaq;
          }
          return null;
        },
      });
    }
    ctx.memory.offerHelp = true;
    return ctx.output.sayAndListen(
      'When you want Guidify to build it, say Help me build it. Is there anything else I can help with?',
      offerHelpListen(),
    );
  }
}

function offerHelpListen(): ListenExpectation {
  return {
    intentions: [
      { name: PLANNER_INTENTIONS.productFaq, boost: 24 },
      { name: PLANNER_INTENTIONS.helpBuild, boost: 22 },
      { name: PLANNER_INTENTIONS.nothingElse, boost: 20 },
      { name: PLANNER_INTENTIONS.sampleTweak, boost: 12 },
      { name: STANDARD_INTENTIONS.isGoodbye, boost: 8 },
      ...portalBoosts(),
    ],
    resolveIntention: ({ userText }) => {
      if (looksLikeSatisfiedClose(userText)) {
        return PLANNER_INTENTIONS.nothingElse;
      }
      if (looksLikeKnowledgeQuestion(userText)) {
        return PLANNER_INTENTIONS.productFaq;
      }
      if (
        /\b(help me build|hire (you|guidify)|get a quote|request a quote)\b/i.test(
          userText,
        )
      ) {
        return PLANNER_INTENTIONS.helpBuild;
      }
      return null;
    },
  };
}
