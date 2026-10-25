import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { EventService } from '../../events/event.service';
import { BrainUsageTracker } from '../brain-usage.tracker';
import type { BrainAdapter } from '../brain.port';
import {
  STUDIO_BRAIN_CONFIG,
  STUDIO_BRAIN_DELEGATE,
  type StudioBrainConfig,
} from '../brain-config';
import {
  DecisionBrainAdapter,
  type DecisionEvaluateInput,
  type DecisionEvaluateResult,
} from './decision-brain.base';

type OpenAiDecisionsResponse = {
  answers?: Array<{
    type?: string;
    name?: string;
    probability?: number;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

/**
 * OpenAI Decisions Brain adapter — `POST /v1/decisions`, one predicate per candidate.
 *
 * Scores only; listen extraction / clarify / judge use `brain.delegate`.
 * Env: OPENAI_API_KEY. Model from `brain.model` (e.g. `gpt-6-luna`).
 */
@Injectable()
export class OpenAiDecisionsBrainAdapter extends DecisionBrainAdapter {
  protected readonly adapterId: string = 'studio-openai-decisions';
  protected readonly logger: Logger = new Logger('OpenAiDecisionsBrainAdapter');

  public constructor(
    usage: BrainUsageTracker,
    events: EventService,
    @Optional()
    @Inject(STUDIO_BRAIN_CONFIG)
    brainConfig?: StudioBrainConfig,
    @Optional()
    @Inject(STUDIO_BRAIN_DELEGATE)
    delegate?: BrainAdapter | null,
  ) {
    super(usage, events, brainConfig, delegate);
  }

  protected requireApiKey(op: string): string {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || apiKey.startsWith('sk-mock')) {
      throw new Error(
        `OpenAiDecisionsBrainAdapter.${op} requires a real OPENAI_API_KEY (not mock).`,
      );
    }
    return apiKey;
  }

  protected async evaluate(
    input: DecisionEvaluateInput,
  ): Promise<DecisionEvaluateResult> {
    const res = await fetch('https://api.openai.com/v1/decisions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
      },
      signal: input.signal,
      body: this.requestBody({
        model: input.model.id,
        input: [
          { role: 'developer', content: input.task },
          {
            role: 'user',
            content: [{ type: 'input_json', data: input.context }],
          },
        ],
        questions: input.questions.map((q) => ({
          type: 'predicate',
          name: q.id,
          instructions: q.instructions,
        })),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`OpenAI decisions scan failed: ${res.status} ${body}`);
      throw new Error(`OpenAiDecisionsBrainAdapter scan error: ${res.status}`);
    }

    const json = (await res.json()) as OpenAiDecisionsResponse;
    const probabilities = new Map<string, number | null>();
    (json.answers ?? []).forEach((answer, index) => {
      const id = answer.name ?? input.questions[index]?.id;
      if (!id) return;
      probabilities.set(
        id,
        answer.type === 'predicate' && typeof answer.probability === 'number'
          ? answer.probability
          : null,
      );
    });

    return {
      probabilities,
      usage: {
        prompt_tokens: json.usage?.input_tokens ?? 0,
        completion_tokens: json.usage?.output_tokens ?? 0,
        total_tokens: json.usage?.total_tokens,
      },
    };
  }
}
