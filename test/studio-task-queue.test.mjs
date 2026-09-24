/**
 * Studio Task Queue — wait / async / dedupe / cross-node require.
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  StudioTaskQueue,
  createStudioTasksApi,
  STUDIO_TASK_QUEUE_META,
} from '../dist/tasks/studio-task-queue.js';

function mockEvents() {
  return {
    persist: mock.fn(async () => undefined),
    log: mock.fn(),
    emit: mock.fn(async (input) => ({ id: 'e1', ...input })),
  };
}

describe('StudioTaskQueue', () => {
  it('wait mode runs to completion before returning', async () => {
    const events = mockEvents();
    const q = new StudioTaskQueue(events, { conversationId: 'c1' });
    let ran = false;
    const handle = await q.dispatch({
      kind: 'demo.wait',
      mode: 'wait',
      run: async () => {
        ran = true;
        return 42;
      },
    });
    assert.equal(ran, true);
    assert.equal(handle.status, 'completed');
    assert.equal(await handle.result, 42);
    const types = events.persist.mock.calls.map((c) => c.arguments[1]);
    assert.ok(types.includes('TASK_ENQUEUED'));
    assert.ok(types.includes('TASK_STARTED'));
    assert.ok(types.includes('TASK_COMPLETED'));
  });

  it('async mode returns before work finishes', async () => {
    const q = new StudioTaskQueue(undefined, { conversationId: 'c1' });
    let resolveWork;
    const gate = new Promise((r) => {
      resolveWork = r;
    });
    const handle = await q.dispatch({
      kind: 'demo.async',
      mode: 'async',
      run: async () => {
        await gate;
        return 'done';
      },
    });
    assert.equal(handle.status, 'running');
    resolveWork();
    assert.equal(await handle.result, 'done');
    assert.equal(handle.status, 'completed');
  });

  it('dedupeKey returns the same pending handle', async () => {
    const events = mockEvents();
    const q = new StudioTaskQueue(events, { conversationId: 'c1' });
    let resolveWork;
    const gate = new Promise((r) => {
      resolveWork = r;
    });
    const first = await q.dispatch({
      kind: 'demo.dedupe',
      mode: 'async',
      dedupeKey: 'sms:conv1',
      run: async () => {
        await gate;
        return 1;
      },
    });
    const second = await q.dispatch({
      kind: 'demo.dedupe',
      mode: 'async',
      dedupeKey: 'sms:conv1',
      run: async () => 2,
    });
    assert.equal(first.taskId, second.taskId);
    const types = events.persist.mock.calls.map((c) => c.arguments[1]);
    assert.ok(types.includes('TASK_DEDUPED'));
    resolveWork();
    assert.equal(await first.result, 1);
  });

  it('require waits on async work from a prior “node” (shared queue)', async () => {
    const events = mockEvents();
    const runtime = {
      conversationId: 'c-dep',
      runtimeInstanceId: 'r1',
      metadata: {},
    };
    const apiA = createStudioTasksApi({
      events,
      runtime,
    });
    let resolveWork;
    const gate = new Promise((r) => {
      resolveWork = r;
    });
    await apiA.dispatch({
      kind: 'demo.prep',
      mode: 'async',
      dedupeKey: 'prep:c-dep',
      run: async () => {
        await gate;
        return { slots: ['9am'] };
      },
    });
    // Same conversation, later node — shared queue on metadata
    assert.ok(runtime.metadata[STUDIO_TASK_QUEUE_META]);
    const apiB = createStudioTasksApi({ events, runtime });
    const pending = apiB.require('prep:c-dep');
    resolveWork();
    const value = await pending;
    assert.deepEqual(value, { slots: ['9am'] });
    const types = events.persist.mock.calls.map((c) => c.arguments[1]);
    assert.ok(types.includes('TASK_AWAITED'));
  });

  it('require returns immediately when the task already completed', async () => {
    const q = new StudioTaskQueue(undefined, { conversationId: 'c2' });
    await q.dispatch({
      kind: 'demo.done',
      mode: 'wait',
      dedupeKey: 'done:c2',
      run: async () => 'ready',
    });
    assert.equal(await q.require('done:c2'), 'ready');
  });
});
