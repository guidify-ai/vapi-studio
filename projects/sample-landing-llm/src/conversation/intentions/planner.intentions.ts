import { Injectable } from '@nestjs/common';
import {
  CodeIntention,
  INTENTION_CASCADE_PHASE,
  INTENTION_RUN_KIND,
  type IntentionContext,
  type IntentionRunResult,
} from '@guidify-ai/vapi-studio';
import {
  MAX_DISCOVERY_ANSWERS,
  PLANNER_INTENTIONS,
  type PlannerSchema,
  type PlannerUseCase,
} from '../planner-schema';

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

function useCaseChoice(
  name: string,
  useCase: PlannerUseCase,
  pattern: RegExp,
) {
  @Injectable()
  class Choice extends CodeIntention<PlannerSchema> {
    readonly name = name;
    phase = INTENTION_CASCADE_PHASE.Match;
    boost = 22;
    priority = 15;
    toNodeId = 'discovery';

    async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
      if (!ctx.memory.companyDoes || ctx.memory.useCase) return null;
      if (/^(yeah|yep|sure|ok|okay|fine)[.!]?\s*$/i.test(ctx.userText.trim())) {
        return null;
      }
      return pattern.test(ctx.userText) ? 0.92 : null;
    }

    async run(
      ctx: IntentionContext<PlannerSchema>,
    ): Promise<IntentionRunResult | null> {
      ctx.memory.useCase = useCase;
      return {
        kind: INTENTION_RUN_KIND.Goto,
        nodeId: 'discovery',
        reason: name,
      };
    }
  }
  return Choice;
}

export const UseCaseQualifyIntention = useCaseChoice(
  PLANNER_INTENTIONS.useCaseQualify,
  'qualify',
  /\b(qualif|screen|lead|intake)\b/i,
);
export const UseCaseBookIntention = useCaseChoice(
  PLANNER_INTENTIONS.useCaseBook,
  'book',
  /\b(book|appoint|schedul|reserv)\b/i,
);
export const UseCaseFaqIntention = useCaseChoice(
  PLANNER_INTENTIONS.useCaseFaq,
  'faq',
  /\b(faq|question|knowledge|info)\b/i,
);
export const UseCaseDispatchIntention = useCaseChoice(
  PLANNER_INTENTIONS.useCaseDispatch,
  'dispatch',
  /\b(dispatch|triage|route|field)\b/i,
);
export const UseCaseOtherIntention = useCaseChoice(
  PLANNER_INTENTIONS.useCaseOther,
  'other',
  /\b(other|custom|something else|not sure)\b/i,
);

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
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 24;
  priority = 16;
  toNodeId = 'integrations';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (!ctx.memory.useCase || ctx.memory.discoveryComplete) return null;
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

@Injectable()
export class DiscoveryAnswerIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.discoveryAnswer;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 16;
  priority = 10;
  toNodeId = 'discovery';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (!ctx.memory.useCase || ctx.memory.discoveryComplete) return null;
    if (
      /\b(proceed|ready|enough|build|go ahead)\b/i.test(ctx.userText)
    ) {
      return null;
    }
    return ctx.userText.trim().length >= 4 ? 0.85 : null;
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
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

@Injectable()
export class HelpBuildIntention extends CodeIntention<PlannerSchema> {
  readonly name = PLANNER_INTENTIONS.helpBuild;
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 26;
  priority = 18;
  toNodeId = 'offerHelp';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    if (!ctx.memory.sampleShown) return null;
    return /\b(help me build|hire|guidify|get a quote)\b/i.test(ctx.userText)
      ? 0.95
      : null;
  }

  async run(
    ctx: IntentionContext<PlannerSchema>,
  ): Promise<IntentionRunResult | null> {
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
    if (/\b(help me build|hire|guidify)\b/i.test(ctx.userText)) return null;
    if (/\b(change|fix|tweak|rewrite)\b/i.test(ctx.userText)) return null;
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
  phase = INTENTION_CASCADE_PHASE.Match;
  boost = 18;
  priority = 13;
  toNodeId = 'goodbye';

  async match(ctx: IntentionContext<PlannerSchema>): Promise<number | null> {
    return /\b(nothing else|all set|that'?s all|no thanks|i'?m done|done)\b/i.test(
      ctx.userText,
    )
      ? 0.92
      : null;
  }

  async run(): Promise<IntentionRunResult | null> {
    return {
      kind: INTENTION_RUN_KIND.Goto,
      nodeId: 'goodbye',
      reason: 'nothing_else',
    };
  }
}
