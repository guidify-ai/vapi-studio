/**
 * Supervisor cascade: force condition transitions skip Brain.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, mock } from 'node:test';
import { MockBrainService } from '../dist/brain/adapters/mock-brain.adapter.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import { AgentNode } from '../dist/node/agent-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';

class OpeningNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('opening');
  }
}

class IdentityNode extends AgentNode {
  async run() {
    throw new Error('identity must not run when phone force fires');
  }
}

class PhoneNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('need your phone');
  }
}

class DivertNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('brain diversion');
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
  return { checkpoint: mock.fn(async () => undefined) };
}

function buildSupervisor(brain, events) {
  const flow = new FlowLoader();
  flow.loadFromObject({
    version: 1,
    flow: { id: 'cond-force', start: 'opening' },
    nodes: {
      opening: {
        class: 'OpeningNode',
        intentions: ['isAcknowledge'],
      },
      identityCollect: {
        class: 'IdentityNode',
        intentions: ['isIdentityCollect', 'isDivert'],
      },
      askSmsPhone: {
        class: 'PhoneNode',
        intentions: ['isCollectedPhone'],
      },
      divert: {
        class: 'DivertNode',
        priority: 99,
        intentions: ['isDivert'],
      },
    },
    transitions: [
      {
        id: 'needSmsPhone',
        from: ['identityCollect'],
        to: 'askSmsPhone',
        when: 'memory.formSendConsent == true && memory.phoneConfirmed != true',
        force: true,
        reason: 'need_sms_phone',
      },
    ],
  });
  const nodes = new Map([
    ['OpeningNode', new OpeningNode()],
    ['IdentityNode', new IdentityNode()],
    ['PhoneNode', new PhoneNode()],
    ['DivertNode', new DivertNode()],
  ]);
  return new Supervisor(brain, flow, nodes, events, mockBootstrap());
}

describe('condition force transitions', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-mock-not-real';
  });

  it('routes to askSmsPhone without Brain when force when matches', async () => {
    const brain = new MockBrainService();
    brain.setSequence('state-machine', ['isDivert']);
    brain.setActiveProfile('state-machine');
    const events = mockEvents();
    const supervisor = buildSupervisor(brain, events);
    const runtime = new SupervisedConversation({
      conversationId: 'conv-cond-1',
      providerCallId: 'call-cond-1',
      flowId: 'cond-force',
      brainProfileId: 'state-machine',
      startNodeId: 'opening',
      runtimeInstanceId: 'runtime-cond-1',
    });

    await supervisor.handleTurn({ runtime, userText: '' });
    runtime.enterNormalNode('identityCollect');
    runtime.memory.formSendConsent = true;
    events.persisted.length = 0;
    events.logged.length = 0;

    const turn = await supervisor.handleTurn({
      runtime,
      userText: 'whatever the brain would steal',
    });
    assert.equal(turn.selectedNodeId, 'askSmsPhone');

    const decisions = events.persisted.filter((e) => e.type === 'ROUTE_DECISION');
    assert.ok(decisions.length >= 1);
    assert.equal(decisions[decisions.length - 1].payload.resolvedVia, 'condition_force');
    assert.equal(
      decisions[decisions.length - 1].payload.winner.nodeId,
      'askSmsPhone',
    );

    const condPersist = events.persisted.filter(
      (e) => e.type === 'CONDITION_TRANSITION',
    );
    assert.ok(condPersist.length >= 1, 'CONDITION_TRANSITION must persist');
    assert.equal(condPersist[0].payload.force, true);
    assert.equal(condPersist[0].payload.to, 'askSmsPhone');

    const scans = events.logged.filter((e) => e.type === 'INTENTION_SCAN');
    assert.equal(scans.length, 0, 'Brain scan must be skipped on force');
  });
});
