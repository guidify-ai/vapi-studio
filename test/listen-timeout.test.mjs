import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_LISTEN_TIMEOUT_SECONDS,
  MAX_LISTEN_TIMEOUT_SECONDS,
  MIN_LISTEN_TIMEOUT_SECONDS,
  clampListenTimeoutSeconds,
  listenTimeoutSecondsToMs,
  listenTimeoutToVapiStartSpeakingPlan,
  mergeSayAndListenOptions,
  resolveListenTimeoutSeconds,
} from '../dist/index.js';

describe('listen timeout', () => {
  it('defaults to 2.5s and clamps', () => {
    assert.equal(DEFAULT_LISTEN_TIMEOUT_SECONDS, 2.5);
    assert.equal(clampListenTimeoutSeconds(0), MIN_LISTEN_TIMEOUT_SECONDS);
    assert.equal(clampListenTimeoutSeconds(99), MAX_LISTEN_TIMEOUT_SECONDS);
    assert.equal(
      clampListenTimeoutSeconds(Number.NaN),
      DEFAULT_LISTEN_TIMEOUT_SECONDS,
    );
  });

  it('resolves sayAndListen > listen() > Node class > default', () => {
    assert.equal(resolveListenTimeoutSeconds({}), DEFAULT_LISTEN_TIMEOUT_SECONDS);
    assert.equal(
      resolveListenTimeoutSeconds({ fromNode: 3.5 }),
      3.5,
    );
    assert.equal(
      resolveListenTimeoutSeconds({ fromNode: 3.5, fromListen: 4 }),
      4,
    );
    assert.equal(
      resolveListenTimeoutSeconds({
        fromNode: 3.5,
        fromListen: 4,
        fromSayAndListen: 1,
      }),
      1,
    );
  });

  it('maps to Vapi startSpeakingPlan endpointing', () => {
    const plan = listenTimeoutToVapiStartSpeakingPlan(3.5);
    assert.equal(plan.customEndpointingRules[0].type, 'assistant');
    assert.equal(plan.customEndpointingRules[0].timeoutSeconds, 3.5);
    assert.equal(plan.transcriptionEndpointingPlan.onPunctuationSeconds, 3.5);
    assert.equal(plan.transcriptionEndpointingPlan.onNoPunctuationSeconds, 3.5);
    assert.equal(listenTimeoutSecondsToMs(2.5), 2500);
  });

  it('mergeSayAndListenOptions keeps timeoutSeconds', () => {
    const merged = mergeSayAndListenOptions(
      { intentions: [{ name: 'isCollectedTimeline' }], timeoutSeconds: 3.5 },
      { timeoutSeconds: 4 },
    );
    assert.equal(merged?.timeoutSeconds, 4);
    const kept = mergeSayAndListenOptions(
      { intentions: [], timeoutSeconds: 3.5 },
      { hints: ['x'] },
    );
    assert.equal(kept?.timeoutSeconds, 3.5);
  });

  it('mergeSayAndListenOptions keeps interruptible', () => {
    const merged = mergeSayAndListenOptions(
      { intentions: [], interruptible: false },
      { timeoutSeconds: 3 },
    );
    assert.equal(merged?.interruptible, false);
    const overridden = mergeSayAndListenOptions(
      { intentions: [], interruptible: true },
      { interruptible: false },
    );
    assert.equal(overridden?.interruptible, false);
  });
});
