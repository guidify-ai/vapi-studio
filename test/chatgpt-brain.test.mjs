import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeProviderOptions } from '../dist/brain/brain-config.js';
import {
  ChatGptBrainAdapter,
  detectUserSpeechSeries,
} from '../dist/brain/adapters/chatgpt-brain.adapter.js';
import { ClaudeBrainAdapter } from '../dist/brain/adapters/claude-brain.adapter.js';
import { GeminiBrainAdapter } from '../dist/brain/adapters/gemini-brain.adapter.js';
import { GrokBrainAdapter } from '../dist/brain/adapters/grok-brain.adapter.js';
import { BrainUsageTracker } from '../dist/brain/brain-usage.tracker.js';
import { coalesceUserUtterances } from '../dist/conversation/call-turn-queue.js';

const noopEvents = new Proxy({}, { get: () => () => {} });

function adapter(Cls, brain) {
  return new Cls(new BrainUsageTracker(), noopEvents, brain);
}

/** Run one completeJson against a stubbed fetch; return the parsed request body. */
async function captureBody(Cls, brain, responseJson) {
  const a = adapter(Cls, brain);
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify(responseJson), { status: 200 });
  };
  try {
    await a.completeJson({
      apiKey: 'test-key',
      model: a.resolveModel(),
      kind: 'scan',
      providerCallId: 'call-body',
      system: 'sys',
      user: 'hi',
    });
  } finally {
    globalThis.fetch = original;
  }
  return sent;
}

const openAiReply = { choices: [{ message: { content: '{}' } }], usage: {} };

test('stock adapters pass any model id through, with no framework default', () => {
  for (const Cls of [
    ChatGptBrainAdapter,
    ClaudeBrainAdapter,
    GeminiBrainAdapter,
    GrokBrainAdapter,
  ]) {
    assert.equal(
      adapter(Cls, { model: 'some-future-model-9' }).resolveModel().id,
      'some-future-model-9',
    );
    assert.throws(() => adapter(Cls, {}).resolveModel(), /requires a model id/);
  }
});

test('OpenAI request sends no sampling settings unless the app adds them', async () => {
  const plain = await captureBody(
    ChatGptBrainAdapter,
    { model: 'gpt-6-luna' },
    openAiReply,
  );
  assert.equal(plain.model, 'gpt-6-luna');
  assert.equal('temperature' in plain, false);
  assert.deepEqual(plain.response_format, { type: 'json_object' });

  const tuned = await captureBody(
    ChatGptBrainAdapter,
    { model: 'gpt-6-luna', providerOptions: { reasoning_effort: 'none' } },
    openAiReply,
  );
  assert.equal(tuned.reasoning_effort, 'none');
});

test('Gemini providerOptions merge into generationConfig without dropping JSON mode', async () => {
  const body = await captureBody(
    GeminiBrainAdapter,
    {
      model: 'gemini-x',
      providerOptions: { generationConfig: { temperature: 0 } },
    },
    { candidates: [{ content: { parts: [{ text: '{}' }] } }] },
  );
  assert.deepEqual(body.generationConfig, {
    responseMimeType: 'application/json',
    temperature: 0,
  });
});

test('mergeProviderOptions replaces scalars and merges objects one level', () => {
  assert.deepEqual(
    mergeProviderOptions(
      { a: 1, cfg: { x: 1, y: 2 } },
      { a: 2, cfg: { y: 3 }, extra: true },
    ),
    { a: 2, cfg: { x: 1, y: 3 }, extra: true },
  );
  assert.deepEqual(mergeProviderOptions({ a: 1 }), { a: 1 });
});

test('detectUserSpeechSeries parses coalesced queue prompt', () => {
  const combined = coalesceUserUtterances(['tomorrow', 'around 10']);
  const series = detectUserSpeechSeries(combined);
  assert.equal(series.isSeries, true);
  assert.deepEqual(series.parts, ['tomorrow', 'around 10']);
});

test('BrainUsageTracker aggregates tokens per call and model', () => {
  const tracker = new BrainUsageTracker();
  tracker.record({
    providerCallId: 'call-1',
    conversationId: 'c1',
    kind: 'scan',
    model: 'gpt-6-luna',
    promptTokens: 1000,
    completionTokens: 100,
  });
  tracker.record({
    providerCallId: 'call-1',
    kind: 'clarify',
    model: 'gpt-6-luna',
    promptTokens: 500,
    completionTokens: 50,
  });
  tracker.record({
    providerCallId: 'call-1',
    kind: 'judge',
    model: 'gpt-6-luna',
    promptTokens: 200,
    completionTokens: 40,
  });
  const summary = tracker.summary('call-1');
  assert.ok(summary);
  assert.equal(summary.calls, 3);
  assert.equal(summary.promptTokens, 1700);
  assert.equal(summary.completionTokens, 190);
  assert.equal(summary.byModel['gpt-6-luna'].calls, 3);
  assert.equal('estimatedUsd' in summary, false);
});
