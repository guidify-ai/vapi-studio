/**
 * Mocked Conversation bootstrap — no Postgres, no OpenAI, no secrets.
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { ConversationBootstrapService } from '../dist/conversation/conversation-bootstrap.service.js';
import { SupervisedConversationRegistry } from '../dist/conversation/supervised-conversation.registry.js';
import { CallTurnQueueRegistry } from '../dist/conversation/call-turn-queue.js';
import { BrainUsageTracker } from '../dist/brain/brain-usage.tracker.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';

function mockEvents() {
  return {
    log: mock.fn(),
    persist: mock.fn(async () => undefined),
  };
}

function mockRepo(createdId = 'conv-mock-1') {
  return {
    createActive: mock.fn(async (input) => ({
      id: createdId,
      provider: 'vapi',
      providerCallId: input.providerCallId,
      status: 'ACTIVE',
      runtimeInstanceId: input.runtimeInstanceId,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      endedAt: null,
      finalState: null,
    })),
    markEnded: mock.fn(async () => undefined),
    findByProviderCallId: mock.fn(async () => null),
    appendEvent: mock.fn(async () => undefined),
    saveRuntimeCheckpoint: mock.fn(async () => undefined),
    listActiveWithRuntimeState: mock.fn(async () => []),
  };
}

describe('ConversationBootstrapService (mocked convo store)', () => {
  it('creates Conversation via repository and registers in-memory runtime', async () => {
    const repo = mockRepo('conv-123');
    const registry = new SupervisedConversationRegistry();
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'test', start: 'start' },
      nodes: {
        start: { class: 'StartNode', intentions: ['isStart'] },
      },
    });
    const events = mockEvents();

    const bootstrap = new ConversationBootstrapService(
      repo,
      registry,
      flow,
      events,
    );

    const runtime = await bootstrap.bootstrap({
      providerCallId: 'call-abc',
      brainProfileId: 'state-machine',
      metadata: { messageType: 'assistant-request' },
    });

    assert.equal(repo.createActive.mock.callCount(), 1);
    const createArg = repo.createActive.mock.calls[0].arguments[0];
    assert.equal(createArg.providerCallId, 'call-abc');
    assert.ok(createArg.runtimeInstanceId);

    assert.equal(runtime.conversationId, 'conv-123');
    assert.equal(runtime.providerCallId, 'call-abc');
    assert.equal(runtime.brainProfileId, 'state-machine');
    assert.deepEqual(runtime.variables, {});
    assert.equal(registry.getByProviderCallId('call-abc'), runtime);

    assert.equal(events.persist.mock.callCount(), 2);
    assert.equal(events.persist.mock.calls[0].arguments[1], 'BOOTSTRAP');
    assert.equal(
      events.persist.mock.calls[1].arguments[1],
      'CONVERSATION_BEFORE_EACH',
    );
  });

  it('reuses in-memory runtime without creating another Conversation', async () => {
    const repo = mockRepo('conv-1');
    const registry = new SupervisedConversationRegistry();
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'test', start: 'start' },
      nodes: { start: { class: 'StartNode', intentions: [] } },
    });
    const events = mockEvents();
    const bootstrap = new ConversationBootstrapService(
      repo,
      registry,
      flow,
      events,
    );

    const first = await bootstrap.bootstrap({
      providerCallId: 'call-1',
      brainProfileId: 'state-machine',
    });
    const second = await bootstrap.bootstrap({
      providerCallId: 'call-1',
      brainProfileId: 'state-machine',
    });

    assert.equal(first.runtimeInstanceId, second.runtimeInstanceId);
    assert.equal(repo.createActive.mock.callCount(), 1);
  });

  it('runs beforeEach on bootstrap and afterEach on finalize', async () => {
    const repo = mockRepo('conv-hooks');
    const registry = new SupervisedConversationRegistry();
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'test', start: 'start' },
      nodes: { start: { class: 'StartNode', intentions: [] } },
    });
    const events = mockEvents();
    const entry = {
      createVariables: mock.fn(() => ({ companyName: 'Acme' })),
      beforeEach: mock.fn(async ({ runtime }) => {
        runtime.memory.hooked = true;
      }),
      afterEach: mock.fn(async ({ runtime }) => {
        runtime.memory.hooked = false;
      }),
    };
    const bootstrap = new ConversationBootstrapService(
      repo,
      registry,
      flow,
      events,
      new CallTurnQueueRegistry(),
      new BrainUsageTracker(),
      entry,
    );

    const runtime = await bootstrap.bootstrap({
      providerCallId: 'call-hooks',
      brainProfileId: 'state-machine',
    });
    assert.equal(entry.beforeEach.mock.callCount(), 1);
    assert.equal(runtime.memory.hooked, true);
    assert.deepEqual(runtime.variables, { companyName: 'Acme' });

    const types = events.persist.mock.calls.map((c) => c.arguments[1]);
    assert.ok(types.includes('BOOTSTRAP'));
    assert.ok(types.includes('CONVERSATION_BEFORE_EACH'));

    await bootstrap.finalizeEnded('call-hooks');
    assert.equal(entry.afterEach.mock.callCount(), 1);
    const typesAfter = events.persist.mock.calls.map((c) => c.arguments[1]);
    assert.ok(typesAfter.includes('CONVERSATION_AFTER_EACH'));
    assert.ok(typesAfter.includes('FINALIZE'));
    assert.equal(repo.markEnded.mock.callCount(), 1);
    assert.equal(registry.getByProviderCallId('call-hooks'), undefined);
  });
});
