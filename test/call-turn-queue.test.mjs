import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CallTurnQueue,
  coalesceUserUtterances,
} from '../dist/conversation/call-turn-queue.js';

test('coalesceUserUtterances joins distinct series with instruction', () => {
  const text = coalesceUserUtterances(['tomorrow', 'around 10am']);
  assert.match(text, /several times/i);
  assert.match(text, /1\) tomorrow/);
  assert.match(text, /2\) around 10am/);
});

test('coalesceUserUtterances folds near-duplicates to longer form', () => {
  const text = coalesceUserUtterances([
    'It is the first.',
    'It is the first. One.',
  ]);
  assert.equal(text, 'It is the first. One.');
});

test('CallTurnQueue runs empty speak-first opening turn', async () => {
  const q = new CallTurnQueue();
  const seen = [];
  const a = q.runExclusive({
    userText: '',
    work: async (combined) => {
      seen.push(`open:${combined}`);
      return 'open';
    },
  });
  const b = q.runExclusive({
    userText: '',
    work: async (combined) => {
      seen.push(`dup:${combined}`);
      return 'dup';
    },
  });
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra.status, 'ran');
  assert.equal(rb.status, 'skipped');
  assert.deepEqual(seen, ['open:']);
});

test('CallTurnQueue listen hold coalesces a late ASR fragment', async () => {
  const q = new CallTurnQueue();
  const seen = [];

  const a = q.runExclusive({
    userText: 'K.',
    listenHoldMs: 60,
    work: async (combined) => {
      seen.push(combined);
      return 'a';
    },
  });

  await new Promise((r) => setTimeout(r, 20));
  const b = q.runExclusive({
    userText: 'asap',
    listenHoldMs: 60,
    work: async (combined) => {
      seen.push(`waiter:${combined}`);
      return 'b';
    },
  });

  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra.status, 'ran');
  assert.equal(rb.status, 'skipped');
  assert.equal(seen.length, 1);
  assert.match(seen[0], /K/);
  assert.match(seen[0], /asap/);
});

test('CallTurnQueue does not hold the empty opening turn', async () => {
  const q = new CallTurnQueue();
  const t0 = Date.now();
  const r = await q.runExclusive({
    userText: '',
    listenHoldMs: 200,
    work: async () => 'open',
  });
  assert.equal(r.status, 'ran');
  assert.ok(Date.now() - t0 < 150);
});

test('CallTurnQueue leader drains waiter speech after working when asked', async () => {
  const q = new CallTurnQueue();
  const seen = [];

  const a = q.runExclusive({
    userText: 'first',
    continueDraining: () => true,
    work: async (combined) => {
      seen.push(combined);
      await new Promise((r) => setTimeout(r, 30));
      return 'a';
    },
  });

  await new Promise((r) => setTimeout(r, 5));
  assert.equal(q.isWorking, true);

  const b = q.runExclusive({
    userText: 'second',
    work: async (combined) => {
      seen.push(`waiter:${combined}`);
      return 'b';
    },
  });

  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra.status, 'ran');
  assert.equal(rb.status, 'skipped');
  assert.deepEqual(seen, ['first', 'second']);
});

test('CallTurnQueue leaves later speech for the waiting request by default', async () => {
  const q = new CallTurnQueue();
  const seen = [];

  const a = q.runExclusive({
    userText: 'first',
    work: async (combined) => {
      seen.push(combined);
      await new Promise((r) => setTimeout(r, 30));
      return 'a';
    },
  });

  await new Promise((r) => setTimeout(r, 5));
  const b = q.runExclusive({
    userText: 'second',
    work: async (combined) => {
      seen.push(`waiter:${combined}`);
      return 'b';
    },
  });

  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(ra.status, 'ran');
  assert.equal(rb.status, 'ran');
  assert.deepEqual(seen, ['first', 'waiter:second']);
});
