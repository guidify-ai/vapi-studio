import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import type { BrainAdapter } from '../brain.port';
import {
  STUDIO_BRAIN_CONFIG,
  STUDIO_BRAIN_LLM,
  type StudioBrainConfig,
} from '../brain-config';
import {
  DecisionBrainAdapter,
  type DecisionEvaluateInput,
  type DecisionEvaluateResult,
} from './decision-brain.base';

type JevResponse = {
  answers?: Record<string, { type?: string; noul?: number }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * TypeSafe Jev Brain adapter — `POST /v1/systemone`, one `noul` question per candidate.
 *
 * Experimental: tested against recorded request/response shapes only, not the live API.
 *
 * Scores only; clarify / judge use `brain.llm`.
 * Env: TYPESAFE_API_KEY. Model from `brain.model` (e.g. `jev-latest`).
 */
@Injectable()
export class TypeSafeJevBrainAdapter extends DecisionBrainAdapter {
  protected readonly adapterId: string = 'studio-typesafe-jev';
  protected readonly logger: Logger = new Logger('TypeSafeJevBrainAdapter');

  public constructor(
    usage: BrainUsageTracker,
    events: EventService,
    @Optional()
    @Inject(STUDIO_BRAIN_CONFIG)
    brainConfig?: StudioBrainConfig,
    @Optional()
    @Inject(STUDIO_BRAIN_LLM)
    llm?: BrainAdapter | null,
  ) {
    super(usage, events, brainConfig, llm);
  }

  protected requireApiKey(op: string): string {
    const apiKey = process.env.TYPESAFE_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(`TypeSafeJevBrainAdapter.${op} requires TYPESAFE_API_KEY.`);
    }
    return apiKey;
  }

  protected async evaluate(
    input: DecisionEvaluateInput,
  ): Promise<DecisionEvaluateResult> {
    const questions: Record<string, unknown> = {};
    for (const q of input.questions) {
      questions[q.id] = {
        type: 'noul',
        instructions: q.instructions,
        criteria: {
          true: `The caller's latest turn expresses "${q.name}".`,
          false: `The caller's latest turn does not express "${q.name}".`,
        },
      };
    }

    const res = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
      },
      signal: input.signal,
      body: this.requestBody({
        model: input.model.id,
        state: { task: input.task, ...input.context },
        questions,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`TypeSafe Jev scan failed: ${res.status} ${body}`);
      throw new Error(`TypeSafeJevBrainAdapter scan error: ${res.status}`);
    }

    const json = (await res.json()) as JevResponse;
    const probabilities = new Map<string, number | null>();
    for (const q of input.questions) {
      const answer = json.answers?.[q.id];
      probabilities.set(
        q.id,
        answer?.type === 'noul' && typeof answer.noul === 'number'
          ? answer.noul
          : null,
      );
    }

    return {
      probabilities,
      usage: {
        prompt_tokens: json.usage?.input_tokens ?? 0,
        completion_tokens: json.usage?.output_tokens ?? 0,
      },
    };
  }
}
