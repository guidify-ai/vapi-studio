/**
 * Conversation turn/time limits — fail-closed endCall.
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { MockBrainService } from '../dist/brain/adapters/mock-brain.adapter.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import {
  evaluateConversationLimits,
  resolveConversationLimits,
  DEFAULT_MAX_CONVERSATION_TURNS,
  HARD_MAX_CONVERSATION_TURNS,
} from '../dist/conversation/conversation-limits.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import { Ra9Node } from '../dist/node/ra9-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';

class OpeningNode extends Ra9Node {
  async run(ctx) {
    return ctx.output.sayAndListen('Hi — what is your name?');
  }
}

class EchoNode extends Ra9Node {
  async run(ctx) {
    return ctx.output.sayAndListen('Okay, go on.');
  }
}

function mockEvents() {
  return {
    log: mock.fn(),
    persist: mock.fn(async () => undefined),
  };
}

function buildSupervisor(limits) {
  const flow = new FlowLoader();
  flow.loadFromObject({
    version: 1,
    flow: { id: 'limits-test', start: 'opening' },
    nodes: {
      opening: { class: 'OpeningNode', intentions: ['isOpening'] },
      echo: { class: 'EchoNode', intentions: ['isEcho'] },
    },
  });
  const nodes = new Map([
    ['OpeningNode', new OpeningNode()],
    ['EchoNode', new EchoNode()],
  ]);
  const events = mockEvents();
  const brain = new MockBrainService();
  brain.setSequence('state-machine', ['isEcho', 'isEcho', 'isEcho']);
  brain.setActiveProfile('state-machine');
  // positional: brain, flow, nodes, events, bootstrap, integrations, forms, brainConfig, intentions, limits
  const supervisor = new Supervisor(
    brain,
    flow,
    nodes,
    events,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    resolveConversationLimits(limits),
  );
  return { supervisor, events };
}

describe('Conversation limits', () => {
  it('resolveConversationLimits clamps and defaults', () => {
    const d = resolveConversationLimits();
    assert.equal(d.maxTurns, DEFAULT_MAX_CONVERSATION_TURNS);
    assert.equal(resolveConversationLimits({ maxTurns: 999 }).maxTurns, HARD_MAX_CONVERSATION_TURNS);
    assert.equal(resolveConversationLimits({ maxTurns: 0 }).maxTurns, 1);
  });

  it('evaluateConversationLimits flags max turns and duration', () => {
    const limits = resolveConversationLimits({ maxTurns: 3, maxDurationMs: 5_000 });
    const start = new Date('2026-01-01T00:00:00.000Z');
    assert.equal(
      evaluateConversationLimits({
        turnNumber: 3,
        createdAt: start,
        now: new Date('2026-01-01T00:00:04.000Z'),
        limits,
      }).exceeded,
      false,
    );
    const turns = evaluateConversationLimits({
      turnNumber: 4,
      createdAt: start,
      now: new Date('2026-01-01T00:00:01.000Z'),
      limits,
    });
    assert.equal(turns.exceeded, true);
    if (turns.exceeded) assert.equal(turns.reason, 'max_turns');

    const duration = evaluateConversationLimits({
      turnNumber: 1,
      createdAt: start,
      now: new Date('2026-01-01T00:00:06.000Z'),
      limits,
    });
    assert.equal(duration.exceeded, true);
    if (duration.exceeded) assert.equal(duration.reason, 'max_duration');
  });

  it('Supervisor endCalls when maxTurns exceeded', async () => {
    const { supervisor, events } = buildSupervisor({
      maxTurns: 2,
      endMessage: 'Time to wrap up. Goodbye.',
    });
    const runtime = new SupervisedConversation({
      conversationId: 'c1',
      providerCallId: 'p1',
      flowId: 'limits-test',
      brainProfileId: 'state-machine',
      startNodeId: 'opening',
    });

    const open = await supervisor.handleTurn({ runtime, userText: '' });
    assert.equal(open.result.kind, 'sayAndListen');
    assert.equal(runtime.turn.turnNumber, 1);
    runtime.openingCompleted = true;
    runtime.currentNodeId = 'echo';

    const t2 = await supervisor.handleTurn({ runtime, userText: 'hello' });
    assert.equal(t2.result.kind, 'sayAndListen');
    assert.equal(runtime.turn.turnNumber, 2);

    const t3 = await supervisor.handleTurn({ runtime, userText: 'again' });
    assert.equal(t3.result.kind, 'endCall');
    assert.equal(t3.result.text, 'Time to wrap up. Goodbye.');
    assert.equal(runtime.turn.turnNumber, 3);

    const limitLogs = events.log.mock.calls.filter(
      (c) => c.arguments[1] === 'CONVERSATION_LIMIT_EXCEEDED',
    );
    assert.equal(limitLogs.length, 1);
    assert.equal(limitLogs[0].arguments[2].reason, 'max_turns');
  });

  it('Supervisor endCalls when maxDurationMs exceeded', async () => {
    const { supervisor, events } = buildSupervisor({
      maxTurns: 40,
      maxDurationMs: 1_000,
      endMessage: 'Call timed out. Goodbye.',
    });
    const runtime = new SupervisedConversation({
      conversationId: 'c2',
      providerCallId: 'p2',
      flowId: 'limits-test',
      brainProfileId: 'state-machine',
      startNodeId: 'opening',
    });
    runtime.createdAt = new Date(Date.now() - 5_000);
    runtime.openingCompleted = true;
    runtime.currentNodeId = 'echo';

    const turn = await supervisor.handleTurn({ runtime, userText: 'hi' });
    assert.equal(turn.result.kind, 'endCall');
    assert.equal(turn.result.text, 'Call timed out. Goodbye.');

    const limitLogs = events.log.mock.calls.filter(
      (c) => c.arguments[1] === 'CONVERSATION_LIMIT_EXCEEDED',
    );
    assert.equal(limitLogs.length, 1);
    assert.equal(limitLogs[0].arguments[2].reason, 'max_duration');
  });

  it('fromSnapshot restores createdAt for duration limits', () => {
    const runtime = new SupervisedConversation({
      conversationId: 'c3',
      providerCallId: 'p3',
      flowId: 'limits-test',
      brainProfileId: 'mock',
      startNodeId: 'opening',
    });
    const stamp = '2026-01-01T12:00:00.000Z';
    const snap = runtime.snapshot();
    snap.createdAt = stamp;
    const restored = SupervisedConversation.fromSnapshot(snap);
    assert.equal(restored.createdAt.toISOString(), stamp);
  });
});
