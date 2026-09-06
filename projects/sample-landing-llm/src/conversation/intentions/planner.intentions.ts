import { Injectable } from '@nestjs/common';
import {
  CodeIntention,
  INTENTION_CASCADE_PHASE,
  INTENTION_RUN_KIND,
  STANDARD_INTENTIONS,
  type IntentionContext,
  type IntentionRunResult,
} from '@guidify-ai/vapi-studio';
import {
  MAX_DISCOVERY_ANSWERS,
  PLANNER_INTENTIONS,
  type PlannerSchema,
} from '../planner-schema';
import { looksLikeKnowledgeQuestion } from '../lib/planner-knowledge';
import { looksLikeMad, looksLikeSoftContinue, looksLikeGibberish } from '../lib/looks-like-mad';
import { looksLikeSatisfiedClose, looksLikeSamplePraise } from '../lib/satisfied-close';

/** Force mad portal — Match discovery/company-does must never swallow abuse. */
@Injectable()
export class MadDetectIntention extends CodeIntention<PlannerSchema> {
  readonly name = STANDARD_INTENTIONS.isMad;
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 40;
  priority = 50;
  toNodeId = 'mad';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    return looksLikeMad(ctx.userText);
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'mad',
      reason: 'mad_detect',
    };
  }
}

/** Nonsense → unknown (don't invent a use-case lane). */
@Injectable()
export class GibberishDetectIntention extends CodeIntention<PlannerSchema> {
  readonly name = STANDARD_INTENTIONS.isUnknownTransition;
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 36;
  priority = 46;
  toNodeId = 'unknownTransition';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (ctx.runtime.portalState.activePortalId) return false;
    return looksLikeGibberish(ctx.userText);
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'unknownTransition',
      reason: 'gibberish_detect',
    };
  }
}

/** While in a portal, soft continue → ContinueNode (silent origin replay). */
@Injectable()
export class SoftContinueIntention extends CodeIntention<PlannerSchema> {
  readonly name = 'isContinue';
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 38;
  priority = 48;
  toNodeId = 'continue';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.runtime.portalState.activePortalId) return false;
    return looksLikeSoftContinue(ctx.userText);
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'continue',
      reason: 'soft_continue',
    };
  }
}

@Injectable()
export class CompanyDoesCollectedIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.companyDoesCollected;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 20;
  priority = 14;
  toNodeId = 'useCase';
  reason = 'company_does_collected';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    const t = ctx.userText.trim();
    if (t.length < 8) return null;
    if (looksLikeMad(t)) return null;
    if (looksLikeGibberish(t)) return null;
    if (/^(yes|no|ok|okay|sure|yeah)[.!]?\s*$/i.test(t)) return null;
    if (ctx.memory.companyDoes) return null;
    return 0.9;
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    if (!ctx.memory.companyDoes) {
      ctx.memory.companyDoes = ctx.userText.trim().slice(0, 280);
    }
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'useCase',
      reason: 'company_does_collected',
    };
  }
}

@Injectable()
export class UseCaseQualifyIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.useCaseQualify;
  /** Force — never wait on Brain for clear lane picks (Brain timeout → unknown). */
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 22;
  priority = 15;
  toNodeId = 'discovery';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.companyDoes || ctx.memory.useCase) return false;
    if (/^(yeah|yep|sure|ok|okay|fine)[.!]?\s*$/i.test(ctx.userText.trim())) {
      return false;
    }
    return /\b(qualif|screen|lead|intake)\b/i.test(ctx.userText);
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    ctx.memory.useCase = 'qualify';
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'discovery',
      reason: PLANNER_INTENTIONS.useCaseQualify,
    };
  }
}

@Injectable()
export class UseCaseBookIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.useCaseBook;
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 22;
  priority = 15;
  toNodeId = 'discovery';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.companyDoes || ctx.memory.useCase) return false;
    if (/^(yeah|yep|sure|ok|okay|fine)[.!]?\s*$/i.test(ctx.userText.trim())) {
      return false;
    }
    return /\b(book|appoint|schedul|reserv)\b/i.test(ctx.userText);
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    ctx.memory.useCase = 'book';
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'discovery',
      reason: PLANNER_INTENTIONS.useCaseBook,
    };
  }
}

@Injectable()
export class UseCaseFaqIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.useCaseFaq;
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 22;
  priority = 15;
  toNodeId = 'discovery';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.companyDoes || ctx.memory.useCase) return false;
    if (/^(yeah|yep|sure|ok|okay|fine)[.!]?\s*$/i.test(ctx.userText.trim())) {
      return false;
    }
    return /\b(faq|knowledge base|informational)\b/i.test(ctx.userText);
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    ctx.memory.useCase = 'faq';
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'discovery',
      reason: PLANNER_INTENTIONS.useCaseFaq,
    };
  }
}

@Injectable()
export class UseCaseDispatchIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.useCaseDispatch;
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 22;
  priority = 15;
  toNodeId = 'discovery';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.companyDoes || ctx.memory.useCase) return false;
    if (/^(yeah|yep|sure|ok|okay|fine)[.!]?\s*$/i.test(ctx.userText.trim())) {
      return false;
    }
    return /\b(dispatch|triage|route|field)\b/i.test(ctx.userText);
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    ctx.memory.useCase = 'dispatch';
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'discovery',
      reason: PLANNER_INTENTIONS.useCaseDispatch,
    };
  }
}

@Injectable()
export class UseCaseOtherIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.useCaseOther;
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 18;
  priority = 12;
  toNodeId = 'discovery';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.companyDoes || ctx.memory.useCase) return false;
    if (/^(yeah|yep|sure|ok|okay|fine)[.!]?\s*$/i.test(ctx.userText.trim())) {
      return false;
    }
    if (/\b(not sure|maybe|voice ai|idk)\b/i.test(ctx.userText)) return false;
    return /\b(other|custom|something else)\b/i.test(ctx.userText);
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    ctx.memory.useCase = 'other';
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'discovery',
      reason: PLANNER_INTENTIONS.useCaseOther,
    };
  }
}

/** Vague use case → propose qualify (Nest LP doctrine). */
@Injectable()
export class UseCaseVagueIntention extends CodeIntention<PlannerSchema> {
  readonly name = 'use_case_vague';
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 30;
  priority = 19;
  toNodeId = 'discovery';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.companyDoes || ctx.memory.useCase) return false;
    if (looksLikeSoftContinue(ctx.userText)) return false;
    if (looksLikeGibberish(ctx.userText)) return false;
    return /\b(not sure|maybe|voice ai|something with (ai|voice)|whatever|idk|i don't know)\b/i.test(
      ctx.userText,
    );
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    ctx.memory.useCase = 'qualify';
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'discovery',
      reason: 'use_case_vague_default_qualify',
    };
  }
}

/** Soft affirmative on multi-choice without naming a lane → re-ask use case. */
@Injectable()
export class UseCaseClarifyIntention extends CodeIntention<PlannerSchema> {
  readonly name = 'use_case_clarify';
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 28;
  priority = 17;
  toNodeId = 'useCase';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (!ctx.memory.companyDoes || ctx.memory.useCase) return null;
    return /^(yeah|yep|yup|sure|ok|okay|fine|alright|why not|sounds good)[.!]?\s*$/i.test(
      ctx.userText.trim(),
    )
      ? 0.97
      : null;
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'useCase',
      reason: 'use_case_clarify',
    };
  }
}

@Injectable()
export class DiscoveryProceedIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.discoveryProceed;
  /** Clear “enough / proceed / build” — Match skips Brain. */
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 24;
  priority = 16;
  toNodeId = 'integrations';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (!ctx.memory.useCase || ctx.memory.discoveryComplete) return null;
    if (looksLikeKnowledgeQuestion(ctx.userText)) return null;
    if (looksLikeSoftContinue(ctx.userText)) return null;
    if (
      /\b(proceed|ready|enough|build|go ahead|skip|next|let'?s (do|go|build)|that'?s (all|enough))\b/i.test(
        ctx.userText,
      )
    ) {
      return 0.95;
    }
    return null;
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    ctx.memory.discoveryComplete = true;
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'integrations',
      reason: 'discovery_proceed',
    };
  }
}

/** Product FAQ during discovery — never Brain-route to integrations_* mid-intake. */
@Injectable()
export class DiscoveryFaqIntention extends CodeIntention<PlannerSchema> {
  readonly name = 'discovery_faq';
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 28;
  priority = 22;
  toNodeId = 'discovery';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.useCase || ctx.memory.discoveryComplete) return false;
    if (ctx.memory.sampleShown) return false;
    if (wantsHelpBuild(ctx.userText)) return false;
    return looksLikeKnowledgeQuestion(ctx.userText);
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'discovery',
      reason: 'discovery_faq',
    };
  }
}

/**
 * Substantive discovery reply — **Scan** (not Match).
 * Open-ended answers used to Match at 0.85 for any ≥4 chars, which skipped Brain
 * entirely. Cheap path is `DiscoveryNode` `resolveIntention`; ambiguous turns go to Brain.
 */
@Injectable()
export class DiscoveryAnswerIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.discoveryAnswer;
  phase = INTENTION_CASCADE_PHASE.Scan;
  boost = 18;
  priority = 12;
  toNodeId = 'discovery';
  reason = 'discovery_answer';

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
    if (!ctx.memory.useCase || ctx.memory.discoveryComplete) {
      return {
        kind: INTENTION_RUN_KIND.Goto,
        nodeId: 'discovery',
        reason: 'discovery_answer_stale',
      };
    }
    if (looksLikeMad(ctx.userText) || looksLikeKnowledgeQuestion(ctx.userText)) {
      return {
        kind: INTENTION_RUN_KIND.Goto,
        nodeId: 'discovery',
        reason: 'discovery_answer_guard',
      };
    }
    // Bare yes/sure — re-ask same CTA; never store as a discovery answer.
    if (
      /^(yes|yeah|yep|yup|sure|ok|okay|alright|fine|cool|great|why not|sounds good)[.!]?\s*$/i.test(
        ctx.userText.trim(),
      )
    ) {
      return {
        kind: INTENTION_RUN_KIND.Goto,
        nodeId: 'discovery',
        reason: 'discovery_answer_soft',
      };
    }
    const list = ctx.memory.discoveryAnswers ?? [];
    const t = ctx.userText.trim().slice(0, 400);
    if (t && list[list.length - 1] !== t && list.length < MAX_DISCOVERY_ANSWERS) {
      list.push(t);
      ctx.memory.discoveryAnswers = list;
    }
    if (list.length >= 3 || list.length >= MAX_DISCOVERY_ANSWERS) {
      ctx.memory.discoveryComplete = true;
      return {
        kind: INTENTION_RUN_KIND.Goto,
        nodeId: 'integrations',
        reason: 'discovery_enough',
      };
    }
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'discovery',
      reason: 'discovery_answer',
    };
  }
}

function integrationChoice(
  name: string,
  interest: 'none' | 'crm' | 'tools',
  pattern: RegExp,
) {
  @Injectable()
  class Choice extends CodeIntention<PlannerSchema> {
    readonly name = name;
    phase = INTENTION_CASCADE_PHASE.Match;
    boost = 20;
    priority = 14;
    toNodeId = 'designPackage';

    async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
      if (!ctx.memory.discoveryComplete) return null;
      if (ctx.memory.integrationInterest !== undefined) return null;
      if (looksLikeKnowledgeQuestion(ctx.userText)) return null;
      if (/^(yeah|yep|sure|ok|okay)[.!]?\s*$/i.test(ctx.userText.trim())) {
        return null;
      }
      return pattern.test(ctx.userText) ? 0.9 : null;
    }

    async run(
      ctx: IntentionContext<PlannerSchema>,
    ): Promise<IntentionRunResult | null> {
      ctx.memory.integrationInterest = interest;
      return {
        kind: INTENTION_RUN_KIND.Goto,
        nodeId: 'designPackage',
        reason: name,
      };
    }
  }
  return Choice;
}

export const IntegrationsNoneIntention = integrationChoice(
  PLANNER_INTENTIONS.integrationsNone,
  'none',
  /\b(none|no|not yet|skip|later)\b/i,
);
export const IntegrationsCrmIntention = integrationChoice(
  PLANNER_INTENTIONS.integrationsCrm,
  'crm',
  /\b(crm|salesforce|hubspot|pipedrive)\b/i,
);
export const IntegrationsToolsIntention = integrationChoice(
  PLANNER_INTENTIONS.integrationsTools,
  'tools',
  /\b(calendar|tool|twilio|zapier|integrat)\b/i,
);

/** True CTA to hire — not "how much does Guidify charge…" (product FAQ). */
function wantsHelpBuild(text: string): boolean {
  return /\b(help me build|hire (you|guidify)|get a quote|request a quote)\b/i.test(
    text,
  );
}

/** Bare none/no after sample — not goodbye / not a correction. */
function softNoneAfterSample(text: string): boolean {
  if (looksLikeSatisfiedClose(text)) return false;
  return /^(none|no|nope|not really|nah)[.!]?\s*$/i.test(text.trim());
}

@Injectable()
export class SampleSoftNoneIntention extends CodeIntention<PlannerSchema> {
  readonly name = 'sample_soft_none';
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 30;
  priority = 21;
  toNodeId = 'showSample';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    return ctx.memory.sampleShown === true && softNoneAfterSample(ctx.userText);
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'showSample',
      reason: 'sample_soft_none',
    };
  }
}

@Injectable()
export class ProductFaqIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.productFaq;
  /** Force — gate in before(); match null still fires at confidence 1. */
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 28;
  priority = 20;
  toNodeId = 'showSample';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.sampleShown) return false;
    if (wantsHelpBuild(ctx.userText)) return false;
    return looksLikeKnowledgeQuestion(ctx.userText);
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'showSample',
      reason: 'product_faq',
    };
  }
}

@Injectable()
export class HelpBuildIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.helpBuild;
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 26;
  priority = 19;
  toNodeId = 'offerHelp';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.sampleShown) return false;
    return wantsHelpBuild(ctx.userText);
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'offerHelp',
      reason: 'help_build',
    };
  }
}

@Injectable()
export class SampleTweakIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.sampleTweak;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 20;
  priority = 14;
  toNodeId = 'corrections';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (!ctx.memory.sampleShown) return null;
    if (looksLikeKnowledgeQuestion(ctx.userText)) return null;
    if (looksLikeSatisfiedClose(ctx.userText)) return null;
    if (looksLikeSamplePraise(ctx.userText)) return null;
    return /\b(change|fix|tweak|wrong|unnatural|rewrite|instead)\b/i.test(
      ctx.userText,
    )
      ? 0.9
      : null;
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'corrections',
      reason: 'sample_tweak',
    };
  }
}

@Injectable()
export class SampleOkIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.sampleOk;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 16;
  priority = 12;
  toNodeId = 'offerHelp';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (!ctx.memory.sampleShown) return null;
    if (looksLikeKnowledgeQuestion(ctx.userText)) return null;
    if (wantsHelpBuild(ctx.userText)) return null;
    if (looksLikeSatisfiedClose(ctx.userText)) return null;
    if (/\b(change|fix|tweak|rewrite)\b/i.test(ctx.userText)) return null;
    if (looksLikeSamplePraise(ctx.userText)) return 0.9;
    return /\b(looks good|ok|okay|thanks|great|perfect|fine|sure)\b/i.test(
      ctx.userText,
    )
      ? 0.88
      : null;
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'offerHelp',
      reason: 'sample_ok',
    };
  }
}

@Injectable()
export class NothingElseIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.nothingElse;
  /** Force — “No, all good” must never fall through to corrections. */
  phase = INTENTION_CASCADE_PHASE.Force;
  boost = 32;
  priority = 22;
  toNodeId = 'farewell';

  async before(ctx: IntentionContext<PlannerSchema>): Promise<boolean> {
    if (!ctx.memory.sampleShown) return false;
    return looksLikeSatisfiedClose(ctx.userText);
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'goodbye',
      reason: 'nothing_else',
    };
  }
}
