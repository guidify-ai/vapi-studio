import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MockBrainAdapter } from '../dist/brain/adapters/mock-brain.adapter.js';
import {
  CONFIDENCE_6_PATTERN,
  DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD,
  formatConfidence6,
  judgeContextToString,
  normalizeJudgeResult,
} from '../dist/brain/brain-judge.js';

describe('Brain judge', () => {
  it('stringifies object context as JSON', () => {
    assert.equal(judgeContextToString('hi'), 'hi');
    assert.equal(judgeContextToString({ firstName: 'Ada' }), '{"firstName":"Ada"}');
    assert.equal(judgeContextToString(null), '');
  });

  it('formatConfidence6 is always \\d.\\d\\d\\d\\d\\d\\d', () => {
    assert.equal(formatConfidence6(0.3), '0.300000');
    assert.equal(formatConfidence6(1), '1.000000');
    assert.equal(formatConfidence6(1.5), '1.000000');
    assert.match(formatConfidence6(0.123456789), CONFIDENCE_6_PATTERN);
  });

  it('normalizeJudgeResult keeps passed as the model judgment', () => {
    const raw = {
      passed: true,
      confidence: 0.3,
      reasoning: ['looks ok'],
    };
    const low = normalizeJudgeResult(raw, { confidenceThreshold: 0.6 });
    assert.equal(low.passed, true);
    assert.equal(low.belowThreshold, true);
    assert.equal(low.confidence, '0.300000');
    assert.match(low.confidence, CONFIDENCE_6_PATTERN);

    const high = normalizeJudgeResult(raw, { confidenceThreshold: 0.2 });
    assert.equal(high.passed, true);
    assert.equal(high.belowThreshold, false);
    assert.equal(DEFAULT_BRAIN_JUDGE_CONFIDENCE_THRESHOLD, 0);
  });

  it('MockBrain.judge passes when success conditions appear in context', async () => {
    const brain = new MockBrainAdapter();
    const result = await brain.judge({
      context: {
        transcript: 'Bot asked first name. User said Mark. Bot asked last name.',
      },
      goals: 'Collect the caller first name before last name',
      successConditions: ['first name', 'last name'],
      failureConditions: ['skipped intro'],
    });
    assert.equal(result.passed, true);
    assert.match(result.confidence, CONFIDENCE_6_PATTERN);
    assert.ok(Number(result.confidence) > 0);
    assert.ok(result.reasoning.length >= 1);
  });

  it('MockBrain.judge fails on failure conditions and explicit markers', async () => {
    const brain = new MockBrainAdapter();
    const failed = await brain.judge({
      context: 'Thanks, I. And your last name?',
      goals: 'Ask first name then last name',
      successConditions: ['first name'],
      failureConditions: ['last name'],
    });
    assert.equal(failed.passed, false);

    const marker = await brain.judge({
      context: 'ra9.judge.fail',
      goals: 'anything',
      successConditions: [],
      failureConditions: [],
    });
    assert.equal(marker.passed, false);
    assert.equal(marker.confidence, '1.000000');
  });

  it('MockBrain.judge flags belowThreshold without flipping passed', async () => {
    const brain = new MockBrainAdapter();
    const result = await brain.judge({
      context: { uttered: 'Mark' },
      goals: 'Got a first name',
      successConditions: ['mark'],
      failureConditions: [],
      options: { confidenceThreshold: 0.99 },
    });
    assert.equal(result.passed, true);
    assert.equal(result.belowThreshold, true);
    assert.match(result.confidence, CONFIDENCE_6_PATTERN);
  });
});
