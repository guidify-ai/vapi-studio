import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveCheapOpenAiModel,
  estimateUsdCost,
  DEFAULT_CHEAP_OPENAI_MODEL,
  CHEAP_OPENAI_MODEL_IDS,
} from '../dist/brain/openai-cheap-models.js';
import { detectUserSpeechSeries } from '../dist/brain/adapters/chatgpt-brain.adapter.js';
import { BrainUsageTracker } from '../dist/brain/brain-usage.tracker.js';
import { coalesceUserUtterances } from '../dist/conversation/call-turn-queue.js';

test('resolveCheapOpenAiModel defaults to gpt-4.1-nano', () => {
  assert.equal(resolveCheapOpenAiModel().id, DEFAULT_CHEAP_OPENAI_MODEL);
  assert.equal(resolveCheapOpenAiModel('').id, DEFAULT_CHEAP_OPENAI_MODEL);
  assert.equal(resolveCheapOpenAiModel('gpt-4o-mini').id, 'gpt-4o-mini');
});

test('resolveCheapOpenAiModel rejects expensive models', () => {
  assert.throws(
    () => resolveCheapOpenAiModel('gpt-4o'),
    /cheap whitelist/i,
  );
  assert.ok(CHEAP_OPENAI_MODEL_IDS.includes('gpt-4o-mini'));
});

test('estimateUsdCost uses whitelist pricing', () => {
  const usd = estimateUsdCost({
    model: 'gpt-4.1-nano',
    promptTokens: 1_000_000,
    completionTokens: 1_000_000,
  });
  assert.equal(usd, 0.1 + 0.4);
});

test('detectUserSpeechSeries parses coalesced queue prompt', () => {
  const combined = coalesceUserUtterances(['tomorrow', 'around 10']);
  const series = detectUserSpeechSeries(combined);
  assert.equal(series.isSeries, true);
  assert.deepEqual(series.parts, ['tomorrow', 'around 10']);
});

test('BrainUsageTracker aggregates $$$ for a call', () => {
  const tracker = new BrainUsageTracker();
  tracker.record({
    providerCallId: 'call-1',
    conversationId: 'c1',
    kind: 'scan',
    model: 'gpt-4.1-nano',
    promptTokens: 1000,
    completionTokens: 100,
  });
  tracker.record({
    providerCallId: 'call-1',
    kind: 'clarify',
    model: 'gpt-4.1-nano',
    promptTokens: 500,
    completionTokens: 50,
  });
  tracker.record({
    providerCallId: 'call-1',
    kind: 'judge',
    model: 'gpt-4.1-nano',
    promptTokens: 200,
    completionTokens: 40,
  });
  const summary = tracker.summary('call-1');
  assert.ok(summary);
  assert.equal(summary.calls, 3);
  assert.equal(summary.promptTokens, 1700);
  assert.equal(summary.completionTokens, 190);
  assert.ok(summary.estimatedUsd > 0);
  assert.match(tracker.formatMoney(summary.estimatedUsd), /^\$/);
});
