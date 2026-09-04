/**
 * Supervisor persists ROUTE_DECISION with winner + before() rejects.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, mock } from 'node:test';
import { MockBrainService } from '../dist/brain/adapters/mock-brain.adapter.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import { AgentNode } from '../dist/node/agent-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';
import { STANDARD_INTENTIONS } from '../dist/intentions/standard-intentions.js';

class WinnerNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('winner spoke');
  }
}

class RejectBeforeNode extends AgentNode {
  async before() {
    return false;
  }
  async run() {
    throw new Error('must not run');
  }
}

class OpeningNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('opening');
  }
}

function mockEvents() {
  const persisted = [];
  const logged = [];
  return {
    persisted,
    logged,
    log: mock.fn((level, type, payload) => {
      logged.push({ level, type, payload });
    }),
    persist: mock.fn(async (conversationId, type, payload) => {
      persisted.push({ conversationId, type, payload });
    }),
  };
}

function mockBootstrap() {
  return {
    checkpoint: mock.fn(async () => undefined),
  };
}

function buildSupervisor(brain, events) {
  const flow = new FlowLoader();
  flow.loadFromObject({
    version: 1,
    flow: { id: 'route-forensics', start: 'opening' },
    nodes: {
      opening: {
        class: 'OpeningNode',
        intentions: ['isAcknowledge', 'studio.opening'],
      },
      rejectFirst: {
        class: 'RejectBeforeNode',
        priority: 50,
        intentions: ['isTarget'],
      },
      winner: {
        class: 'WinnerNode',
        priority: 10,
        intentions: ['isTarget'],
      },
    },
  });
  const nodes = new Map([
    ['OpeningNode', new OpeningNode()],
    ['RejectBeforeNode', new RejectBeforeNode()],
    ['WinnerNode', new WinnerNode()],
  ]);
  return new Supervisor(
    brain,
    flow,
    nodes,
    events,
    mockBootstrap(),
  );
}

describe('ROUTE_DECISION forensics', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-mock-not-real';
  });

  it('persists winner + before_false reject when a higher-priority node refuses', async () => {
    const brain = new MockBrainService();
    brain.setSequence('state-machine', ['isTarget']);
    brain.setActiveProfile('state-machine');
    const events = mockEvents();
    const supervisor = buildSupervisor(brain, events);
    const runtime = new SupervisedConversation({
      conversationId: 'conv-route-1',
      providerCallId: 'call-route-1',
      flowId: 'route-forensics',
      brainProfileId: 'state-machine',
      startNodeId: 'opening',
      runtimeInstanceId: 'runtime-route-1',
    });

    await supervisor.handleTurn({ runtime, userText: '' });
    events.persisted.length = 0;

    const turn = await supervisor.handleTurn({
      runtime,
      userText: 'please route me',
    });
    assert.equal(turn.selectedNodeId, 'winner');

    const decisions = events.persisted.filter((e) => e.type === 'ROUTE_DECISION');
    assert.ok(decisions.length >= 1, 'expected ROUTE_DECISION persist');
    const last = decisions[decisions.length - 1];
    assert.equal(last.conversationId, 'conv-route-1');
    assert.equal(last.payload.userText, 'please route me');
    assert.equal(last.payload.winner.nodeId, 'winner');
    assert.equal(last.payload.winner.class, 'WinnerNode');
    assert.equal(last.payload.winner.intention, 'isTarget');
    assert.ok(
      last.payload.rejected.some(
        (r) =>
          r.nodeId === 'rejectFirst' &&
          r.reason === 'before_false' &&
          r.intention === 'isTarget',
      ),
      `expected before_false reject, got ${JSON.stringify(last.payload.rejected)}`,
    );
    assert.ok(Array.isArray(last.payload.walk));
    assert.equal(last.payload.memory.introSpoken, undefined);
  });

  it('includes introSpoken in ROUTE_DECISION memory when set', async () => {
    const brain = new MockBrainService();
    brain.setSequence('state-machine', ['isTarget']);
    brain.setActiveProfile('state-machine');
    const events = mockEvents();
    const supervisor = buildSupervisor(brain, events);
    const runtime = new SupervisedConversation({
      conversationId: 'conv-route-2',
      providerCallId: 'call-route-2',
      flowId: 'route-forensics',
      brainProfileId: 'state-machine',
      startNodeId: 'opening',
      runtimeInstanceId: 'runtime-route-2',
    });
    runtime.memory.introSpoken = true;

    await supervisor.handleTurn({ runtime, userText: '' });
    events.persisted.length = 0;
    await supervisor.handleTurn({ runtime, userText: 'yes' });

    const last = events.persisted.filter((e) => e.type === 'ROUTE_DECISION').at(-1);
    assert.ok(last);
    assert.equal(last.payload.memory.introSpoken, true);
  });
});
