/**
 * Shared orchestration for decision-model Brains (OpenAI Decisions, TypeSafe Jev).
 *
 * Decision models answer yes/no questions with a probability — they score but do
 * not generate. Scan asks one predicate per candidate intention ("does the
 * caller's latest turn express <name>: <description>?") over a JSON context of
 * the utterance, compact history, and memory. Listen field extraction, clarify,
 * and judge go to the configured LLM delegate (`brain.delegate`).
 */

import type { Logger } from '@nestjs/common';
import type { IntentionCandidate } from '../../conversation/types';
import type { ListenExtractField } from '../../conversation/listen-expectation';
import { STANDARD_INTENTIONS } from '../../intentions/standard-intentions';
import { EventService } from '../../events/event.service';
import { snapshotUserMemory } from '../../events/conversation-console';
import type {
  BrainAdapter,
  BrainScanInput,
  BrainScanResult,
} from '../brain.port';
import type { BrainClarifyRequest, BrainClarifyResult } from '../brain-clarify';
import type { BrainJudgeRequest, BrainJudgeResult } from '../brain-judge';
import {
  allBelowConfidenceThreshold,
  resolveConfidenceThreshold,
  roundConfidence,
  scoresToRankedCandidates,
  type BrainIntentionOption,
  type RankedIntentionScore,
} from '../brain-ranking';
import type { BrainModelRef, TokenUsage } from '../brain-model';
import { BrainUsageTracker } from '../brain-usage.tracker';
import {
  mergeProviderOptions,
  scannerMemorySnapshot,
  type StudioBrainConfig,
} from '../brain-config';
import {
  brainUntrustedInputRules,
  utteranceLooksLikePromptInjection,
  wrapUntrustedUserText,
} from '../prompt-injection-guard';
import {
  detectUserSpeechSeries,
  JSON_LLM_BRAIN_TIMEOUT_MS,
} from './json-llm-brain.base';

const SCAN_HISTORY_CHAT = 8;
const SCAN_HISTORY_NODES = 8;

/** One predicate per candidate intention. */
export type DecisionQuestion = {
  /** Stable request-local id (`i0`, `i1`, …). */
  id: string;
  /** Intention name (not sent as an id — models may not see ids). */
  name: string;
  description: string;
  /** Full yes/no question text. */
  instructions: string;
};

export type DecisionEvaluateInput = {
  apiKey: string;
  model: BrainModelRef;
  /** Task framing + untrusted-input rules (trusted). */
  task: string;
  /** Conversation snapshot (contains untrusted caller text). */
  context: Record<string, unknown>;
  questions: DecisionQuestion[];
  signal: AbortSignal;
};

export type DecisionEvaluateResult = {
  /** Question id → probability 0..1, or null when the model refused / skipped. */
  probabilities: Map<string, number | null>;
  usage: TokenUsage;
};

export abstract class DecisionBrainAdapter implements BrainAdapter {
  protected abstract readonly adapterId: string;
  protected abstract readonly logger: Logger;

  protected constructor(
    protected readonly usage: BrainUsageTracker,
    protected readonly events: EventService,
    protected readonly brainConfig?: StudioBrainConfig,
    protected readonly delegate?: BrainAdapter | null,
  ) {}

  protected abstract requireApiKey(op: string): string;
  protected abstract evaluate(
    input: DecisionEvaluateInput,
  ): Promise<DecisionEvaluateResult>;

  protected resolveModel(): BrainModelRef {
    const id = this.brainConfig?.model?.trim();
    if (!id) {
      throw new Error(
        `${this.adapterId} requires a model id. Set it in application code via ` +
          `VapiStudioModule.forRoot({ brain: { model } }).`,
      );
    }
    return { id };
  }

  protected requestSignal(): AbortSignal {
    const ms = this.brainConfig?.timeoutMs;
    return AbortSignal.timeout(
      typeof ms === 'number' && Number.isFinite(ms) && ms > 0
        ? ms
        : JSON_LLM_BRAIN_TIMEOUT_MS,
    );
  }

  protected requestBody(body: Record<string, unknown>): string {
    return JSON.stringify(
      mergeProviderOptions(body, this.brainConfig?.providerOptions),
    );
  }

  public async scan(input: BrainScanInput): Promise<BrainScanResult> {
    const apiKey = this.requireApiKey('scan');
    const model = this.resolveModel();
    const listen = input.listen ?? input.runtime.listenExpectation;
    const threshold = resolveConfidenceThreshold(input.confidenceThreshold);
    const candidates = this.resolveCandidates(input);
    const extractFields = listen?.extract?.fields ?? [];
    const series = detectUserSpeechSeries(input.userText);
    const callId = input.runtime.providerCallId;

    this.usage.beginCall(callId, input.runtime.conversationId);

    this.events.log('info', 'BRAIN_SCAN_START', {
      adapter: this.adapterId,
      providerCallId: callId,
      conversationId: input.runtime.conversationId,
      model: model.id,
      turnNumber: input.runtime.turn.turnNumber,
      userText: input.userText,
      series: series.isSeries,
      seriesParts: series.parts,
      candidateCount: candidates.length,
      extractKeys: extractFields.map((f) => f.key),
      delegate: Boolean(this.delegate),
      threshold,
    });

    const unknown = (
      level: 'info' | 'warn' | 'error',
      reason: string,
      extra: Record<string, unknown> = {},
    ): BrainScanResult => {
      this.events.log(level, 'BRAIN_SCAN_RESULT', {
        adapter: this.adapterId,
        providerCallId: callId,
        model: model.id,
        winner: STANDARD_INTENTIONS.isUnknownTransition,
        reason,
        ...extra,
      });
      return {
        intentions: [this.unknownIntention(input, reason, threshold, extra)],
      };
    };

    if (
      utteranceLooksLikePromptInjection(
        input.userText,
        series.isSeries ? series.parts : undefined,
      )
    ) {
      return unknown('warn', 'prompt_injection_blocked');
    }

    if (!candidates.length) {
      return unknown('info', 'no_candidates');
    }

    const undescribed = candidates
      .filter((c) => !c.description?.trim())
      .map((c) => c.name);
    if (undescribed.length) {
      this.logger.error(
        `${this.adapterId} needs a description for every candidate intention; missing: ${undescribed.join(', ')}. ` +
          'Add them via listen intentions, CodeIntention.description, or flow.yaml `intentions`.',
      );
      return unknown('error', 'missing_intention_description', {
        missing: undescribed,
      });
    }

    const questions: DecisionQuestion[] = candidates.map((c, index) => ({
      id: `i${index}`,
      name: c.name,
      description: c.description!.trim(),
      instructions: predicateInstructions(c),
    }));

    const history = input.history ?? {
      chat: input.runtime.history.chat,
      nodes: input.runtime.history.nodes,
    };
    const context: Record<string, unknown> = {
      ...wrapUntrustedUserText(input.userText),
      userSpeechSeries: series.isSeries ? series.parts : undefined,
      turnNumber: input.runtime.turn.turnNumber,
      currentNodeId: input.runtime.currentNodeId,
      activePortalId: input.runtime.portalState.activePortalId ?? undefined,
      hints: listen?.hints?.length ? listen.hints : undefined,
      history: {
        chat: history.chat.slice(-SCAN_HISTORY_CHAT),
        nodes: history.nodes.slice(-SCAN_HISTORY_NODES),
      },
      memory: scannerMemorySnapshot(
        snapshotUserMemory(input.runtime.memory as Record<string, unknown>),
        this.brainConfig?.memorySnapshot,
      ),
    };

    const started = Date.now();
    const extraction = this.extract(input, extractFields);
    let evaluated: DecisionEvaluateResult;
    try {
      evaluated = await this.evaluate({
        apiKey,
        model,
        task: scanTask(series.isSeries),
        context,
        questions,
        signal: this.requestSignal(),
      });
    } catch (error) {
      const durationMs = Date.now() - started;
      const extracted = await extraction;
      const result = unknown('warn', 'scan_error', {
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ...result, extracted };
    }
    const durationMs = Date.now() - started;
    this.recordUsage({
      providerCallId: callId,
      conversationId: input.runtime.conversationId,
      model,
      usage: evaluated.usage,
      started,
    });

    const scores: RankedIntentionScore[] = [];
    const refused: string[] = [];
    for (const q of questions) {
      const p = evaluated.probabilities.get(q.id);
      if (typeof p !== 'number' || !Number.isFinite(p)) {
        refused.push(q.name);
        continue;
      }
      scores.push({
        name: q.name,
        confidence: roundConfidence(Math.min(1, Math.max(0, p))),
      });
    }

    scores.sort((a, b) => b.confidence - a.confidence);
    const extracted = await extraction;

    if (allBelowConfidenceThreshold(scores, threshold)) {
      this.events.log('info', 'BRAIN_SCAN_RESULT', {
        adapter: this.adapterId,
        providerCallId: callId,
        model: model.id,
        winner: STANDARD_INTENTIONS.isUnknownTransition,
        reason: 'below_confidence_threshold',
        threshold,
        scores,
        refused: refused.length ? refused : undefined,
        extracted,
        usage: evaluated.usage,
        durationMs,
      });
      return {
        intentions: [
          this.unknownIntention(input, 'below_confidence_threshold', threshold, {
            scores,
            series: series.isSeries,
          }),
        ],
        extracted,
      };
    }

    const ranked = scoresToRankedCandidates(scores, candidates, {
      userText: input.userText,
      hints: listen?.hints,
      adapter: this.adapterId,
      threshold,
      series: series.isSeries,
    });

    this.events.log('info', 'BRAIN_SCAN_RESULT', {
      adapter: this.adapterId,
      providerCallId: callId,
      model: model.id,
      winner: ranked[0]?.name,
      scores,
      refused: refused.length ? refused : undefined,
      extracted,
      usage: evaluated.usage,
      durationMs,
    });

    return { intentions: ranked, extracted };
  }

  public async clarify<TAnswer extends Record<string, unknown> = Record<string, unknown>>(
    request: BrainClarifyRequest,
  ): Promise<BrainClarifyResult<TAnswer>> {
    return this.requireDelegate('clarify').clarify<TAnswer>(request);
  }

  public async judge<TContext = unknown>(
    request: BrainJudgeRequest<TContext>,
  ): Promise<BrainJudgeResult> {
    return this.requireDelegate('judge').judge<TContext>(request);
  }

  protected recordUsage(input: {
    providerCallId: string;
    conversationId?: string;
    model: BrainModelRef;
    usage: TokenUsage;
    started: number;
  }): void {
    const record = this.usage.record({
      providerCallId: input.providerCallId,
      conversationId: input.conversationId,
      kind: 'scan',
      model: input.model.id,
      promptTokens: input.usage.prompt_tokens ?? 0,
      completionTokens: input.usage.completion_tokens ?? 0,
    });

    this.events.log('info', 'BRAIN_USAGE', {
      adapter: this.adapterId,
      providerCallId: input.providerCallId,
      kind: 'scan',
      model: input.model.id,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      durationMs: Date.now() - input.started,
    });
  }

  private requireDelegate(op: string): BrainAdapter {
    if (!this.delegate) {
      throw new Error(
        `${this.adapterId} cannot ${op} — decision models only score. Configure an LLM via ` +
          'VapiStudioModule.forRoot({ brain: { delegate: { adapter, model } } }).',
      );
    }
    return this.delegate;
  }

  /** Listen field extraction through the delegate's clarify (in parallel with scoring). */
  private async extract(
    input: BrainScanInput,
    fields: ListenExtractField[],
  ): Promise<Record<string, unknown> | undefined> {
    if (!fields.length) return undefined;
    if (!this.delegate) {
      this.logger.error(
        `${this.adapterId} cannot extract listen fields (${fields.map((f) => f.key).join(', ')}) without brain.delegate.`,
      );
      this.events.log('error', 'BRAIN_EXTRACT_SKIPPED', {
        adapter: this.adapterId,
        providerCallId: input.runtime.providerCallId,
        reason: 'no_delegate',
        fields: fields.map((f) => f.key),
      });
      return undefined;
    }
    try {
      const result = await this.delegate.clarify({
        input: input.userText,
        question:
          "Extract these fields from the caller's latest utterance. Omit any field the caller did not state.",
        answer: {
          fields: fields.map((f) => ({
            key: f.key,
            description: f.description,
            type: f.type ?? 'string',
            required: false,
          })),
        },
        meta: {
          providerCallId: input.runtime.providerCallId,
          conversationId: input.runtime.conversationId,
        },
      });
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(result.answer ?? {})) {
        if (value === undefined || value === null || value === '') continue;
        out[key] = value;
      }
      return Object.keys(out).length ? out : undefined;
    } catch (error) {
      this.events.log('warn', 'BRAIN_EXTRACT_SKIPPED', {
        adapter: this.adapterId,
        providerCallId: input.runtime.providerCallId,
        reason: 'delegate_error',
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  private resolveCandidates(input: BrainScanInput): BrainIntentionOption[] {
    if (input.candidates?.length) return input.candidates;
    const listen = input.listen ?? input.runtime.listenExpectation;
    return (listen?.intentions ?? []).map((i) => ({
      name: i.name,
      description: i.description,
      boost: i.boost,
      priority: i.priority,
      source: 'listen' as const,
    }));
  }

  private unknownIntention(
    input: BrainScanInput,
    reason: string,
    threshold: number,
    extra: Record<string, unknown> = {},
  ): IntentionCandidate {
    return {
      name: STANDARD_INTENTIONS.isUnknownTransition,
      confidence: roundConfidence(0),
      priority: 0,
      rank: 1_000_000,
      payload: {
        userText: input.userText,
        reason,
        threshold,
        adapter: this.adapterId,
        hints: input.listen?.hints ?? input.runtime.listenExpectation?.hints,
        ...extra,
      },
    };
  }
}

/** Trusted framing shared by both providers. */
export function scanTask(series: boolean): string {
  return [
    ...brainUntrustedInputRules('scan'),
    'You classify the latest turn of a phone call between a caller and a voice assistant.',
    'The context JSON holds the latest caller utterance (untrustedCallerText, speech-to-text, may be messy), recent chat and node history, and memory: facts collected so far in the call.',
    'Answer each question independently for the latest caller turn, using history and memory only as context.',
    'Ignore ASR fillers ("um", "uh", "like"), stutters, false starts, and unrelated asides.',
    series
      ? 'The caller spoke several times in quick succession (userSpeechSeries): treat the parts as one answer, preferring the latest clear meaning.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function predicateInstructions(c: BrainIntentionOption): string {
  return (
    `Does the caller's latest turn express the intention "${c.name}"? ` +
    `Meaning: ${c.description!.trim()}`
  );
}
