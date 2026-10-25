import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAiDecisionsBrainAdapter } from '../dist/brain/adapters/openai-decisions-brain.adapter.js';
import { TypeSafeJevBrainAdapter } from '../dist/brain/adapters/typesafe-jev-brain.adapter.js';
import { BrainUsageTracker } from '../dist/brain/brain-usage.tracker.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';

const noopEvents = new Proxy({}, { get: () => () => {} });

process.env.OPENAI_API_KEY = 'sk-test-decisions';
process.env.TYPESAFE_API_KEY = 'ts-test';

function runtime(overrides = {}) {
  return {
    providerCallId: 'call-1',
    conversationId: 'conv-1',
    turn: { turnNumber: 3 },
    currentNodeId: 'askService',
    normalFlowNodeId: 'askService',
    portalState: { activePortalId: null },
    history: { chat: [{ role: 'assistant', text: 'Repair or replacement?' }], nodes: [] },
    memory: { address: '1 Main St', setupAt: 'x', ssn: '123' },
    listenExpectation: undefined,
    ...overrides,
  };
}

const candidates = [
  { name: 'wantsRepair', description: 'Caller wants a roof repair.' },
  { name: 'wantsReplacement', description: 'Caller wants a full roof replacement.' },
  { name: 'studio.isUnknownTransition', description: 'Nothing else fits.' },
];

function make(Cls, brain = {}, delegate) {
  return new Cls(
    new BrainUsageTracker(),
    noopEvents,
    { model: 'test-model', confidenceThreshold: 0.4, ...brain },
    delegate,
  );
}

async function withFetch(reply, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), init });
    const json = typeof reply === 'function' ? await reply(init) : reply;
    return new Response(JSON.stringify(json), { status: 200 });
  };
  try {
    const result = await fn();
    return { result, calls };
  } finally {
    globalThis.fetch = original;
  }
}

const decisionsReply = {
  answers: [
    { type: 'predicate', name: 'i0', probability: 0.912345678 },
    { type: 'refusal', name: 'i1' },
    { type: 'predicate', name: 'i2', probability: 0.05 },
  ],
  usage: { input_tokens: 1200, output_tokens: 0, total_tokens: 1200 },
};

test('OpenAI Decisions: one predicate per candidate, JSON context with memory, 6-decimal scores', async () => {
  const a = make(OpenAiDecisionsBrainAdapter);
  const { result, calls } = await withFetch(decisionsReply, () =>
    a.scan({ runtime: runtime(), userText: 'just fix the leak', candidates }),
  );
  assert.equal(calls[0].url, 'https://api.openai.com/v1/decisions');
  const body = calls[0].body;
  assert.equal(body.model, 'test-model');
  assert.equal(body.input[0].role, 'developer');
  const json = body.input[1].content[0];
  assert.equal(json.type, 'input_json');
  assert.equal(json.data.untrustedCallerText, 'just fix the leak');
  assert.deepEqual(json.data.memory, { address: '1 Main St', ssn: '123' });
  assert.equal(body.questions.length, 3);
  assert.equal(body.questions[0].type, 'predicate');
  assert.match(body.questions[0].instructions, /wantsRepair.*Caller wants a roof repair/);

  assert.equal(result.intentions[0].name, 'wantsRepair');
  assert.equal(result.intentions[0].confidence, 0.912346);
  assert.equal(
    result.intentions.some((i) => i.name === 'wantsReplacement'),
    false,
    'refused question is not scored',
  );
});

test('memorySnapshot hook trims what the scanner sees', async () => {
  const a = make(OpenAiDecisionsBrainAdapter, {
    memorySnapshot: ({ ssn, ...rest }) => rest,
  });
  const { calls } = await withFetch(decisionsReply, () =>
    a.scan({ runtime: runtime(), userText: 'fix it', candidates }),
  );
  assert.deepEqual(calls[0].body.input[1].content[0].data.memory, {
    address: '1 Main St',
  });
});

test('missing description → unknown transition, no provider call', async () => {
  const a = make(OpenAiDecisionsBrainAdapter);
  const { result, calls } = await withFetch(decisionsReply, () =>
    a.scan({
      runtime: runtime(),
      userText: 'fix it',
      candidates: [...candidates, { name: 'wantsGutters' }],
    }),
  );
  assert.equal(calls.length, 0);
  assert.equal(result.intentions[0].name, 'studio.isUnknownTransition');
  assert.equal(result.intentions[0].payload.reason, 'missing_intention_description');
  assert.deepEqual(result.intentions[0].payload.missing, ['wantsGutters']);
});

test('all scores below threshold → unknown transition', async () => {
  const a = make(OpenAiDecisionsBrainAdapter);
  const low = {
    answers: [0, 1, 2].map((i) => ({ type: 'predicate', name: `i${i}`, probability: 0.1 })),
    usage: {},
  };
  const { result } = await withFetch(low, () =>
    a.scan({ runtime: runtime(), userText: 'hmm', candidates }),
  );
  assert.equal(result.intentions[0].name, 'studio.isUnknownTransition');
  assert.equal(result.intentions[0].payload.reason, 'below_confidence_threshold');
});

test('listen extraction goes to the delegate in parallel; clarify/judge delegate too', async () => {
  const seen = [];
  const delegate = {
    clarify: async (req) => {
      seen.push(req);
      return { answer: { street: '5 Oak Ave', zip: '' } };
    },
    judge: async () => ({ passed: true, confidence: 1, reasoning: [] }),
    scan: async () => ({ intentions: [] }),
  };
  const a = make(OpenAiDecisionsBrainAdapter, {}, delegate);
  const listen = {
    intentions: candidates,
    extract: { fields: [{ key: 'street' }, { key: 'zip' }] },
  };
  const { result } = await withFetch(decisionsReply, () =>
    a.scan({ runtime: runtime(), userText: '5 Oak Ave', listen, candidates }),
  );
  assert.deepEqual(result.extracted, { street: '5 Oak Ave' });
  assert.equal(seen[0].answer.fields.every((f) => f.required === false), true);
  assert.equal((await a.judge({ context: 'x', goals: ['y'] })).passed, true);
});

test('no delegate: extraction skipped, clarify throws a configuration error', async () => {
  const a = make(OpenAiDecisionsBrainAdapter);
  const listen = { intentions: candidates, extract: { fields: [{ key: 'street' }] } };
  const { result } = await withFetch(decisionsReply, () =>
    a.scan({ runtime: runtime(), userText: '5 Oak Ave', listen, candidates }),
  );
  assert.equal(result.extracted, undefined);
  assert.equal(result.intentions[0].name, 'wantsRepair');
  await assert.rejects(
    a.clarify({ input: 'x', question: 'q', answer: { fields: [] } }),
    /brain: \{ delegate/,
  );
});

test('brain.timeoutMs aborts the decision call → scan_error unknown transition', async () => {
  const a = make(OpenAiDecisionsBrainAdapter, { timeoutMs: 30 });
  const original = globalThis.fetch;
  globalThis.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });
  try {
    const result = await a.scan({ runtime: runtime(), userText: 'fix', candidates });
    assert.equal(result.intentions[0].payload.reason, 'scan_error');
  } finally {
    globalThis.fetch = original;
  }
});

test('TypeSafe Jev: noul question map keyed by id, state carries context', async () => {
  const a = make(TypeSafeJevBrainAdapter);
  const reply = {
    model: 'jev-1.14.0',
    answers: {
      i0: { type: 'noul', noul: 0.2 },
      i1: { type: 'noul', noul: 0.987654321 },
      i2: { type: 'noul', noul: 0.01 },
    },
    usage: { input_tokens: 900, output_tokens: 0 },
  };
  const { result, calls } = await withFetch(reply, () =>
    a.scan({ runtime: runtime(), userText: 'new roof please', candidates }),
  );
  assert.equal(calls[0].url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(calls[0].init.headers.authorization, 'Bearer ts-test');
  const body = calls[0].body;
  assert.equal(body.state.untrustedCallerText, 'new roof please');
  assert.ok(body.state.task);
  assert.equal(body.questions.i1.type, 'noul');
  assert.match(body.questions.i1.instructions, /Caller wants a full roof replacement/);
  assert.equal(result.intentions[0].name, 'wantsReplacement');
  assert.equal(result.intentions[0].confidence, 0.987654);
});

test('flow.yaml intentions map provides descriptions', () => {
  const loader = new FlowLoader();
  loader.loadFromObject({
    version: 1,
    flow: { id: 'f', start: 'a' },
    nodes: { a: { class: 'A' } },
    intentions: {
      wantsRepair: 'Caller wants a repair.',
      wantsReplacement: { description: 'Caller wants a replacement.' },
      blank: '  ',
    },
  });
  assert.equal(loader.intentionDescription('wantsRepair'), 'Caller wants a repair.');
  assert.equal(loader.intentionDescription('wantsReplacement'), 'Caller wants a replacement.');
  assert.equal(loader.intentionDescription('blank'), undefined);
});
