import { readFileSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { parse as parseYaml } from 'yaml';
import type { IntentionCandidate } from '../../conversation/types';
import { mockExtractFromUserText } from '../../conversation/listen-expectation';
import { DEFAULT_INTENTION_PRIORITY } from '../../conversation/conversation-history';
import { roundConfidence } from '../brain-ranking';
import type {
  BrainAdapter,
  BrainScanInput,
  BrainScanResult,
} from '../brain.port';
import {
  clarifiableInputToString,
  normalizeClarifyResult,
  throwClarifyCannotAnswer,
  type BrainClarifyRequest,
  type BrainClarifyResult,
} from '../brain-clarify';
import {
  judgeContextToString,
  normalizeJudgeResult,
  type BrainJudgeRequest,
  type BrainJudgeResult,
} from '../brain-judge';

interface BrainProfileFile {
  sequence: string[];
}

/**
 * Deterministic Brain adapter for PoC / tests.
 * No network, no ChatGPT — sequence-driven intentions + listen boosts/hints + mock extract.
 */
@Injectable()
export class MockBrainAdapter implements BrainAdapter {
  private profiles: Map<string, string[]> = new Map<string, string[]>();
  private activeProfileId: string = 'state-machine';

  public loadProfile(profileId: string, path: string): void {
    const raw = parseYaml(readFileSync(path, 'utf8')) as BrainProfileFile;
    if (!raw?.sequence?.length) {
      throw new Error(`Invalid brain profile at ${path}`);
    }
    this.setSequence(profileId, raw.sequence);
  }

  public setSequence(profileId: string, sequence: string[]): void {
    if (!sequence.length) {
      throw new Error(`Brain sequence empty for profile ${profileId}`);
    }
    this.profiles.set(profileId, sequence);
  }

  public setActiveProfile(profileId: string): void {
    if (!this.profiles.has(profileId)) {
      throw new Error(`Unknown brain profile: ${profileId}`);
    }
    this.activeProfileId = profileId;
  }

  public getActiveProfileId(): string {
    return this.activeProfileId;
  }

  public async scan(input: BrainScanInput): Promise<BrainScanResult> {
    const profileId = input.runtime.brainProfileId || this.activeProfileId;
    const sequence = this.profiles.get(profileId);
    if (!sequence) {
      throw new Error(`Brain profile not loaded: ${profileId}`);
    }
    const listen = input.listen ?? input.runtime.listenExpectation;
    const index = input.runtime.brainSequenceIndex;
    const mk = (
      name: string,
      confidence: number,
      priority: number,
      payload: Record<string, unknown>,
    ): IntentionCandidate => ({
      name,
      confidence: roundConfidence(confidence),
      priority,
      rank: Math.round((1 - roundConfidence(confidence)) * 1_000_000),
      payload: { ...payload, confidence: roundConfidence(confidence), priority },
    });

    let candidates: IntentionCandidate[];

    if (index >= sequence.length) {
      candidates = [
        mk(sequence[sequence.length - 1], 1, 1_000_000, {
          userText: input.userText,
          exhausted: true,
          hints: listen?.hints,
          adapter: 'mock',
        }),
      ];
    } else {
      const name = sequence[index];
      input.runtime.brainSequenceIndex = index + 1;
      candidates = [
        mk(name, 1, 1_000_000, {
          userText: input.userText,
          sequenceIndex: index,
          hints: listen?.hints,
          adapter: 'mock',
        }),
      ];
    }

    if (listen?.intentions?.length) {
      for (const intent of listen.intentions) {
        if (candidates.some((c) => c.name === intent.name)) {
          continue;
        }
        candidates.push(
          mk(intent.name, 0.15, intent.priority ?? DEFAULT_INTENTION_PRIORITY, {
            userText: input.userText,
            fromListenHint: true,
            hints: listen.hints,
            adapter: 'mock',
            listenBoost: intent.boost,
          }),
        );
      }
    }

    const extracted = mockExtractFromUserText(
      input.userText,
      listen?.extract?.fields,
    );

    return {
      intentions: candidates,
      extracted: Object.keys(extracted).length ? extracted : undefined,
    };
  }

  /**
   * Deterministic clarify for tests — fills required string fields from input text.
   * Empty / reserved marker input → studio.clarify.cannotAnswer.
   */
  public async clarify<TAnswer extends Record<string, unknown> = Record<string, unknown>>(
    request: BrainClarifyRequest,
  ): Promise<BrainClarifyResult<TAnswer>> {
    const text = clarifiableInputToString(request.input).trim();
    if (
      !text ||
      /^studio\.clarify\.cannotAnswer$/i.test(text) ||
      /\bcannot\s*answer\b/i.test(text)
    ) {
      throwClarifyCannotAnswer(
        !text ? 'empty_input' : 'explicit_cannot_answer',
      );
    }

    const answer: Record<string, unknown> = {};
    for (const field of request.answer.fields ?? []) {
      if (field.type === 'boolean') {
        answer[field.key] = /\b(yes|true|yep)\b/i.test(text);
        continue;
      }
      if (field.type === 'number') {
        const n = text.match(/-?\d+(?:\.\d+)?/);
        answer[field.key] = n ? Number(n[0]) : null;
        continue;
      }
      if (field.type === 'object' || field.type === 'array') {
        answer[field.key] = null;
        continue;
      }
      const named =
        text.match(
          /(?:my name is|i(?:'| a)?m|call me|it(?:'| i)?s)\s+([A-Za-z][A-Za-z'-]*)/i,
        ) ?? text.match(/^([A-Za-z][A-Za-z'-]*)$/);
      answer[field.key] = named?.[1] ?? (text ? text.split(/\s+/)[0] : null);
    }
    return normalizeClarifyResult<TAnswer>(
      { answer },
      request.answer,
    );
  }

  /**
   * Deterministic judge for tests — no network.
   * Markers in context: `studio.judge.pass` / `studio.judge.fail`.
   * Otherwise: any matching failureCondition → fail; all successConditions
   * present (or none given) → pass.
   */
  public async judge<TContext = unknown>(
    request: BrainJudgeRequest<TContext>,
  ): Promise<BrainJudgeResult> {
    const text = judgeContextToString(request.context).trim();
    const success = request.successConditions ?? [];
    const failure = request.failureConditions ?? [];
    const haystack = text.toLowerCase();

    if (!text || /^studio\.judge\.fail$/i.test(text)) {
      return normalizeJudgeResult(
        {
          passed: false,
          confidence: text ? 1 : 0,
          reasoning: [text ? 'explicit_fail_marker' : 'empty_context'],
        },
        request.options,
      );
    }

    if (/studio\.judge\.fail\b/i.test(text)) {
      return normalizeJudgeResult(
        {
          passed: false,
          confidence: 1,
          reasoning: ['explicit_fail_marker'],
        },
        request.options,
      );
    }

    if (/studio\.judge\.pass\b/i.test(text)) {
      return normalizeJudgeResult(
        {
          passed: true,
          confidence: 1,
          reasoning: ['explicit_pass_marker'],
        },
        request.options,
      );
    }

    const hitFailure = failure.filter((c) =>
      haystack.includes(c.trim().toLowerCase()),
    );
    if (hitFailure.length) {
      return normalizeJudgeResult(
        {
          passed: false,
          confidence: 0.95,
          reasoning: hitFailure.map((c) => `failure_condition: ${c}`),
        },
        request.options,
      );
    }

    const missedSuccess = success.filter(
      (c) => !haystack.includes(c.trim().toLowerCase()),
    );
    if (missedSuccess.length) {
      return normalizeJudgeResult(
        {
          passed: false,
          confidence: 0.8,
          reasoning: missedSuccess.map((c) => `missing_success_condition: ${c}`),
        },
        request.options,
      );
    }

    return normalizeJudgeResult(
      {
        passed: true,
        confidence: 0.9,
        reasoning: success.length
          ? success.map((c) => `success_condition: ${c}`)
          : ['goals_assumed_met'],
      },
      request.options,
    );
  }
}

/** @deprecated Prefer MockBrainAdapter — kept for existing imports. */
export class MockBrainService extends MockBrainAdapter {}
