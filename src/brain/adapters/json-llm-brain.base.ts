/**
 * Shared JSON-LLM Brain orchestration (scan / clarify / judge).
 * Provider adapters only implement auth, model whitelist, and completeJson().
 */

import { Logger } from '@nestjs/common';
import type { IntentionCandidate } from '../../conversation/types';
import { STANDARD_INTENTIONS } from '../../intentions/standard-intentions';
import { EventService } from '../../events/event.service';
import type {
  BrainAdapter,
  BrainScanInput,
  BrainScanResult,
} from '../brain.port';
import {
  clarifiableInputToString,
  normalizeClarifyResult,
  throwClarifyCannotAnswer,
  STUDIO_CLARIFY_CANNOT_ANSWER,
  type BrainClarifyRequest,
  type BrainClarifyResult,
} from '../brain-clarify';
import {
  judgeContextToString,
  normalizeJudgeResult,
  resolveJudgeConfidenceThreshold,
  type BrainJudgeRequest,
  type BrainJudgeResult,
} from '../brain-judge';
import {
  allBelowConfidenceThreshold,
  resolveConfidenceThreshold,
  roundConfidence,
  scoresToRankedCandidates,
  type BrainIntentionOption,
  type RankedIntentionScore,
} from '../brain-ranking';
import type { LlmModelPricing, TokenUsage } from '../llm-model-pricing';
import { BrainUsageTracker } from '../brain-usage.tracker';
import type { StudioBrainConfig } from '../brain-config';
import {
  brainUntrustedInputRules,
  sanitizeExtractedFieldValue,
  utteranceLooksLikePromptInjection,
  wrapUntrustedUserText,
} from '../prompt-injection-guard';

/** Fail the provider round-trip rather than stalling a live call. */
export const JSON_LLM_BRAIN_TIMEOUT_MS = 3_000;

/** Keep scan prompts small — live voice cannot wait on a fat history dump. */
const SCAN_HISTORY_CHAT = 8;
const SCAN_HISTORY_NODES = 8;

export type JsonLlmCompleteInput = {
  apiKey: string;
  model: LlmModelPricing;
  kind: 'scan' | 'clarify' | 'judge';
  providerCallId: string;
  conversationId?: string;
  system: string;
  user: string;
};

/**
 * Template for stock Brain adapters that call a JSON-capable LLM.
 * Subclasses supply API key, model whitelist, and the HTTP completion call.
 */
export abstract class JsonLlmBrainAdapter implements BrainAdapter {
  protected abstract readonly adapterId: string;
  protected abstract readonly logger: Logger;

  protected constructor(
    protected readonly usage: BrainUsageTracker,
    protected readonly events: EventService,
    protected readonly brainConfig?: StudioBrainConfig,
  ) {}

  protected abstract requireApiKey(op: string): string;
  protected abstract resolveModel(override?: string | null): LlmModelPricing;
  protected abstract completeJson(
    input: JsonLlmCompleteInput,
  ): Promise<{ content: string; usage: TokenUsage }>;

  public async scan(input: BrainScanInput): Promise<BrainScanResult> {
    const apiKey = this.requireApiKey('scan');
    const model = this.resolveModel();
    const listen = input.listen ?? input.runtime.listenExpectation;
    const threshold = resolveConfidenceThreshold(input.confidenceThreshold);
    const candidates = this.resolveCandidates(input);
    const extractFields = listen?.extract?.fields ?? [];
    const series = detectUserSpeechSeries(input.userText);

    this.usage.beginCall(
      input.runtime.providerCallId,
      input.runtime.conversationId,
    );

    this.events.log('info', 'BRAIN_SCAN_START', {
      adapter: this.adapterId,
      providerCallId: input.runtime.providerCallId,
      conversationId: input.runtime.conversationId,
      model: model.id,
      turnNumber: input.runtime.turn.turnNumber,
      userText: input.userText,
      series: series.isSeries,
      seriesParts: series.parts,
      candidateCount: candidates.length,
      extractKeys: extractFields.map((f) => f.key),
      threshold,
    });

    if (
      utteranceLooksLikePromptInjection(
        input.userText,
        series.isSeries ? series.parts : undefined,
      )
    ) {
      this.events.log('warn', 'BRAIN_SCAN_RESULT', {
        adapter: this.adapterId,
        providerCallId: input.runtime.providerCallId,
        model: model.id,
        winner: STANDARD_INTENTIONS.isUnknownTransition,
        reason: 'prompt_injection_blocked',
      });
      return {
        intentions: [
          this.unknownIntention(input, 'prompt_injection_blocked', threshold),
        ],
      };
    }

    if (!candidates.length) {
      const empty: BrainScanResult = {
        intentions: [this.unknownIntention(input, 'no_candidates', threshold)],
      };
      this.events.log('info', 'BRAIN_SCAN_RESULT', {
        adapter: this.adapterId,
        providerCallId: input.runtime.providerCallId,
        winner: STANDARD_INTENTIONS.isUnknownTransition,
        reason: 'no_candidates',
      });
      return empty;
    }

    const system = buildScanSystemPrompt({
      candidates,
      extractFields,
      hints: listen?.hints,
      threshold,
      series,
    });

    const history = input.history ?? {
      chat: input.runtime.history.chat,
      nodes: input.runtime.history.nodes,
    };
    const user = JSON.stringify({
      ...wrapUntrustedUserText(input.userText),
      userSpeechSeries: series.isSeries ? series.parts : undefined,
      turnNumber: input.runtime.turn.turnNumber,
      currentNodeId: input.runtime.currentNodeId,
      normalFlowNodeId: input.runtime.normalFlowNodeId,
      activePortalId: input.runtime.portalState.activePortalId,
      history: {
        chat: history.chat.slice(-SCAN_HISTORY_CHAT),
        nodes: history.nodes.slice(-SCAN_HISTORY_NODES),
      },
      listenIntentions: listen?.intentions?.map((i) => ({
        name: i.name,
        boost: i.boost ?? 0,
        priority: i.priority ?? 1,
      })),
    });

    const scanStarted = Date.now();
    let content: string;
    let usage: TokenUsage;
    try {
      const completion = await this.completeJson({
        apiKey,
        model,
        kind: 'scan',
        providerCallId: input.runtime.providerCallId,
        conversationId: input.runtime.conversationId,
        system,
        user,
      });
      content = completion.content;
      usage = completion.usage;
    } catch (error) {
      const durationMs = Date.now() - scanStarted;
      this.events.log('warn', 'BRAIN_SCAN_RESULT', {
        adapter: this.adapterId,
        providerCallId: input.runtime.providerCallId,
        model: model.id,
        winner: STANDARD_INTENTIONS.isUnknownTransition,
        reason: 'scan_error',
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        intentions: [
          this.unknownIntention(input, 'scan_error', threshold, {
            durationMs,
          }),
        ],
      };
    }
    const durationMs = Date.now() - scanStarted;

    const parsed = safeJsonParse(content) as {
      intentions?: Array<{
        name?: string;
        confidence?: number;
        reason?: string;
      }>;
      extracted?: Record<string, unknown>;
    };

    const allowed = new Set(candidates.map((c) => c.name));
    const scores: RankedIntentionScore[] = (parsed.intentions ?? [])
      .filter(
        (i) =>
          typeof i.name === 'string' &&
          allowed.has(i.name.trim()) &&
          typeof i.confidence === 'number',
      )
      .map((i) => ({
        name: String(i.name).trim(),
        confidence: Number(i.confidence),
        reason: i.reason,
      }));

    const extracted = this.filterExtracted(parsed.extracted, extractFields);

    if (allBelowConfidenceThreshold(scores, threshold)) {
      this.events.log('info', 'BRAIN_SCAN_RESULT', {
        adapter: this.adapterId,
        providerCallId: input.runtime.providerCallId,
        model: model.id,
        winner: STANDARD_INTENTIONS.isUnknownTransition,
        reason: 'below_confidence_threshold',
        threshold,
        scores,
        extracted,
        usage,
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
      providerCallId: input.runtime.providerCallId,
      model: model.id,
      winner: ranked[0]?.name,
      scores,
      extracted,
      usage,
      durationMs,
    });

    return {
      intentions: ranked,
      extracted,
    };
  }

  public async clarify<TAnswer extends Record<string, unknown> = Record<string, unknown>>(
    request: BrainClarifyRequest,
  ): Promise<BrainClarifyResult<TAnswer>> {
    const apiKey = this.requireApiKey('clarify');
    const model = this.resolveModel();
    const inputText = clarifiableInputToString(request.input);
    const series = detectUserSpeechSeries(inputText);

    this.events.log('info', 'BRAIN_CLARIFY_START', {
      adapter: this.adapterId,
      providerCallId: request.meta?.providerCallId,
      conversationId: request.meta?.conversationId,
      model: model.id,
      question: request.question,
      input: inputText,
      series: series.isSeries,
      fields: (request.answer.fields ?? []).map((f) => f.key),
    });

    if (
      utteranceLooksLikePromptInjection(
        inputText,
        series.isSeries ? series.parts : undefined,
      )
    ) {
      this.events.log('warn', 'BRAIN_CLARIFY_RESULT', {
        adapter: this.adapterId,
        providerCallId: request.meta?.providerCallId,
        model: model.id,
        question: request.question,
        reason: 'prompt_injection_blocked',
      });
      throwClarifyCannotAnswer('prompt_injection_blocked');
    }

    const system = [
      ...brainUntrustedInputRules('clarify'),
      'You are the Vapi Studio Brain clarifier for a voice bot.',
      'Answer the question about the provided input.',
      'Return ONLY valid JSON in ONE of these forms:',
      '1) {"answer":{...}}',
      `2) {"outcome":"${STUDIO_CLARIFY_CANNOT_ANSWER}","reason":"<short>"}`,
      `Use ${STUDIO_CLARIFY_CANNOT_ANSWER} when the input is insufficient, contradictory, or you cannot reliably fill required fields.`,
      'ASR NOISE: input is often speech-to-text. Filter fillers ("um", "uh", "erm", "hmm", "like", "you know"), stutters, false starts, and unrelated asides / crosstalk when the actionable answer is still clear.',
      'Strip that noise from extracted field values; do not invent content from noise alone.',
      'When answered, the answer object MUST use exactly these fields (omit unknown optional keys):',
      JSON.stringify(
        (request.answer.fields ?? []).map((f) => ({
          key: f.key,
          type: f.type ?? 'string',
          required: f.required ?? false,
          description: f.description,
        })),
      ),
      request.answer.description
        ? `Answer object description: ${request.answer.description}`
        : '',
      series.isSeries
        ? 'Input may list several rapid user utterances — treat them as one answer (after noise filtering), prefer the most specific / latest clear value.'
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const user = JSON.stringify({
      question: request.question,
      ...wrapUntrustedUserText(inputText),
      userSpeechSeries: series.isSeries ? series.parts : undefined,
    });

    const providerCallId =
      request.meta?.providerCallId?.trim() || 'clarify-orphan';

    if (request.meta?.providerCallId) {
      this.usage.beginCall(
        request.meta.providerCallId,
        request.meta.conversationId,
      );
    }

    const { content, usage } = await this.completeJson({
      apiKey,
      model,
      kind: 'clarify',
      providerCallId,
      conversationId: request.meta?.conversationId,
      system,
      user,
    });

    const parsed = safeJsonParse(content);
    const result = normalizeClarifyResult<TAnswer>(parsed, request.answer);

    this.events.log('info', 'BRAIN_CLARIFY_RESULT', {
      adapter: this.adapterId,
      providerCallId: request.meta?.providerCallId,
      model: model.id,
      question: request.question,
      answer: result.answer,
      usage,
    });

    return result;
  }

  public async judge<TContext = unknown>(
    request: BrainJudgeRequest<TContext>,
  ): Promise<BrainJudgeResult> {
    const apiKey = this.requireApiKey('judge');
    const model = this.resolveModel(request.options?.model);
    const contextText = judgeContextToString(request.context);
    const threshold = resolveJudgeConfidenceThreshold(
      request.options?.confidenceThreshold,
    );

    this.events.log('info', 'BRAIN_JUDGE_START', {
      adapter: this.adapterId,
      providerCallId: request.meta?.providerCallId,
      conversationId: request.meta?.conversationId,
      model: model.id,
      goals: request.goals,
      successConditions: request.successConditions,
      failureConditions: request.failureConditions,
      threshold,
    });

    const system = [
      ...brainUntrustedInputRules('judge'),
      'You are an LLM-as-a-judge for Vapi Studio conversation evals.',
      'Read the context. Understand the goal in plain language.',
      'A PASS requires: the goal is met, EVERY success condition holds, and NO failure condition is triggered.',
      'A FAIL if any failure condition is present, any success condition is missing, or the goal is not met.',
      'Return ONLY valid JSON:',
      '{"passed":true,"confidence":0.0,"reasoning":["<short reason>","<short reason>"]}',
      'confidence is 0..1 (1 = certain). reasoning is a list of short strings explaining WHY you passed or failed.',
      'Do not invent facts that are not in the context. Prefer fail when evidence is missing.',
      `Runtime confidence threshold is ${threshold} (informational; still return your raw passed + confidence).`,
    ].join('\n');

    const user = JSON.stringify({
      context: contextText,
      goals: request.goals,
      successConditions: request.successConditions ?? [],
      failureConditions: request.failureConditions ?? [],
    });

    const providerCallId =
      request.meta?.providerCallId?.trim() || 'judge-orphan';

    if (request.meta?.providerCallId) {
      this.usage.beginCall(
        request.meta.providerCallId,
        request.meta.conversationId,
      );
    }

    const { content, usage } = await this.completeJson({
      apiKey,
      model,
      kind: 'judge',
      providerCallId,
      conversationId: request.meta?.conversationId,
      system,
      user,
    });

    const parsed = safeJsonParse(content);
    const result = normalizeJudgeResult(parsed, request.options);

    this.events.log('info', 'BRAIN_JUDGE_RESULT', {
      adapter: this.adapterId,
      providerCallId: request.meta?.providerCallId,
      model: model.id,
      passed: result.passed,
      confidence: result.confidence,
      belowThreshold: result.belowThreshold,
      reasoning: result.reasoning,
      usage,
    });

    return result;
  }

  /** Record usage after a successful provider call (shared by adapters). */
  protected recordUsage(input: {
    providerCallId: string;
    conversationId?: string;
    kind: 'scan' | 'clarify' | 'judge';
    model: LlmModelPricing;
    usage: TokenUsage;
    started: number;
  }): void {
    const record = this.usage.record({
      providerCallId: input.providerCallId,
      conversationId: input.conversationId,
      kind: input.kind,
      model: input.model.id,
      promptTokens: input.usage.prompt_tokens ?? 0,
      completionTokens: input.usage.completion_tokens ?? 0,
    });

    this.events.log('info', 'BRAIN_USAGE', {
      adapter: this.adapterId,
      providerCallId: input.providerCallId,
      kind: input.kind,
      model: input.model.id,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      estimatedUsd: record.estimatedUsd,
      money: this.usage.formatMoney(record.estimatedUsd),
      durationMs: Date.now() - input.started,
    });
  }

  private filterExtracted(
    raw: Record<string, unknown> | undefined,
    fields: Array<{ key: string }>,
  ): Record<string, unknown> | undefined {
    if (!fields.length || !raw || typeof raw !== 'object') {
      return undefined;
    }
    const allowed = new Set(fields.map((f) => f.key));
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!allowed.has(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      if (typeof value === 'string') {
        const sanitized = sanitizeExtractedFieldValue(value);
        if (sanitized === undefined) continue;
        out[key] = sanitized;
        continue;
      }
      out[key] = value;
    }
    return Object.keys(out).length ? out : undefined;
  }

  private resolveCandidates(input: BrainScanInput): BrainIntentionOption[] {
    if (input.candidates?.length) {
      return input.candidates;
    }
    const listen = input.listen ?? input.runtime.listenExpectation;
    return (listen?.intentions ?? []).map((i) => ({
      name: i.name,
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
    const confidence = roundConfidence(0);
    return {
      name: STANDARD_INTENTIONS.isUnknownTransition,
      confidence,
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

function buildScanSystemPrompt(input: {
  candidates: BrainIntentionOption[];
  extractFields: Array<{
    key: string;
    description?: string;
    type?: string;
    required?: boolean;
  }>;
  hints?: string[];
  threshold: number;
  series: { isSeries: boolean; parts: string[] };
}): string {
  return [
    ...brainUntrustedInputRules('scan'),
    'You are the Vapi Studio Brain for a voice bot: score intentions and extract fields.',
    'Score ONLY the provided candidate intentions for the latest user utterance.',
    'Use compact history for context; the latest untrustedCallerText is the turn to score.',
    'Return ONLY valid JSON of the form:',
    '{"intentions":[{"name":"<exact candidate name>","confidence":0.123456,"reason":"<short>"}],"extracted":{"<key>":"<value>"}}',
    'confidence is 0..1 inclusive with 6 decimal places. NEVER return a value above 1.',
    'Include every candidate you can score. Boost is a hint, not a score.',
    `studio.isUnknownTransition is the scan-failure intent — score it high only when none of the other candidates fit.`,
    `Runtime confidence threshold is ${input.threshold} (informational).`,
    'ASR NOISE: untrustedCallerText is speech-to-text and often messy. Mentally filter fillers and dead air such as "um", "uh", "erm", "hmm", "like", "you know", stutters, false starts, and trailing fragments that are not part of the answer.',
    'Also ignore clearly unrelated asides / self-talk / crosstalk when the actionable meaning is still clear (e.g. "uh yeah tomorrow — sorry dog — morning" → tomorrow morning).',
    'Do not invent meaning from noise alone; if after filtering nothing substantive remains, give low confidence.',
    input.series.isSeries
      ? [
          'IMPORTANT: untrustedCallerText may be a SERIES of rapid / overlapping utterances (barge-in queue).',
          'Treat the numbered list as one combined user answer, not separate turns.',
          'Prefer the most specific, latest clear meaning across the series (after noise filtering).',
          `Series parts: ${JSON.stringify(input.series.parts)}`,
        ].join(' ')
      : '',
    input.extractFields.length
      ? `Extract these fields into "extracted" (omit key if truly unknown; strip fillers from values): ${JSON.stringify(
          input.extractFields.map((f) => ({
            key: f.key,
            description: f.description,
            type: f.type ?? 'string',
            required: f.required ?? false,
          })),
        )}`
      : 'No extract fields — return "extracted": {}.',
    `Candidates: ${JSON.stringify(
      input.candidates.map((c) => ({
        name: c.name,
        boost: c.boost ?? 0,
        priority: c.priority ?? 1,
        source: c.source ?? 'flow',
      })),
    )}`,
    input.hints?.length
      ? `ASR/ops hints (transcript may be messy): ${input.hints.join(' | ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Detect CallTurnQueue coalesced multi-utterance user text. */
export function detectUserSpeechSeries(userText: string): {
  isSeries: boolean;
  parts: string[];
} {
  const text = userText.trim();
  if (!text) return { isSeries: false, parts: [] };
  if (!/several times in quick succession/i.test(text)) {
    return { isSeries: false, parts: [text] };
  }
  const parts: string[] = [];
  const re = /^\s*\d+\)\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const part = m[1].trim();
    if (part) parts.push(part);
  }
  return {
    isSeries: parts.length > 1,
    parts: parts.length ? parts : [text],
  };
}

export function safeJsonParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // Providers sometimes wrap JSON in markdown fences.
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        return {};
      }
    }
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}
