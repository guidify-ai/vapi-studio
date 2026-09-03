/**
 * Code intentions (phase: force) route before Brain.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, mock } from 'node:test';
import { MockBrainService } from '../dist/brain/adapters/mock-brain.adapter.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import { Ra9Intention, INTENTION_CASCADE_PHASE, DEFAULT_FORCE_INTENTION_PRIORITY } from '../dist/intention/ra9-intention.js';
import { Ra9Node } from '../dist/node/ra9-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';

class OpeningNode extends Ra9Node {
  async run(ctx) {
    return ctx.output.sayAndListen('opening');
  }
}

class IdentityNode extends Ra9Node {
  async run() {
    throw new Error('identity must not run when force intention fires');
  }
}

class PhoneNode extends Ra9Node {
  async run(ctx) {
    return ctx.output.sayAndListen('need your phone');
  }
}

class NeedPhoneIntention extends Ra9Intention {
  name = 'isNeedSmsPhone';
  phase = INTENTION_CASCADE_PHASE.Force;
  toNodeId = 'askSmsPhone';
  priority = DEFAULT_FORCE_INTENTION_PRIORITY;
  reason = 'need_sms_phone';

  async before(ctx) {
    return (
      ctx.runtime.currentNodeId === 'identityCollect' &&
      ctx.memory.formSendConsent === true &&
      ctx.memory.phoneConfirmed !== true
    );
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

describe('Ra9Intention force cascade', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-mock-not-real';
  });

  it('routes via intention_force without Brain when before() passes', async () => {
    const brain = new MockBrainService();
    brain.setSequence('state-machine', ['isDivert']);
    brain.setActiveProfile('state-machine');
    const events = mockEvents();
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'intent-force', start: 'opening' },
      nodes: {
        opening: { class: 'OpeningNode', intentions: ['isAcknowledge'] },
        identityCollect: {
          class: 'IdentityNode',
          intentions: ['isIdentityCollect'],
        },
        askSmsPhone: {
          class: 'PhoneNode',
          intentions: ['isCollectedPhone'],
        },
      },
    });
    const nodes = new Map([
      ['OpeningNode', new OpeningNode()],
      ['IdentityNode', new IdentityNode()],
      ['PhoneNode', new PhoneNode()],
    ]);
    const intentions = new Map([
      ['isNeedSmsPhone', new NeedPhoneIntention()],
    ]);
    const supervisor = new Supervisor(
      brain,
      flow,
      nodes,
      events,
      mockBootstrap(),
      undefined,
      undefined,
      undefined,
      intentions,
    );
    const runtime = new SupervisedConversation({
      conversationId: 'conv-intent-1',
      providerCallId: 'call-intent-1',
      flowId: 'intent-force',
      brainProfileId: 'state-machine',
      startNodeId: 'opening',
      runtimeInstanceId: 'runtime-intent-1',
    });

    await supervisor.handleTurn({ runtime, userText: '' });
    runtime.enterNormalNode('identityCollect');
    runtime.memory.formSendConsent = true;
    events.persisted.length = 0;

    const turn = await supervisor.handleTurn({
      runtime,
      userText: 'brain would steal this',
    });
    assert.equal(turn.selectedNodeId, 'askSmsPhone');

    const forced = events.persisted.filter((e) => e.type === 'INTENTION_FORCE');
    assert.ok(forced.length >= 1);
    assert.equal(forced[0].payload.intention, 'isNeedSmsPhone');
    assert.equal(forced[0].payload.to, 'askSmsPhone');

    const decisions = events.persisted.filter((e) => e.type === 'ROUTE_DECISION');
    assert.equal(
      decisions[decisions.length - 1].payload.resolvedVia,
      'intention_force',
    );
    assert.equal(
      events.logged.filter((e) => e.type === 'INTENTION_SCAN').length,
      0,
    );
  });
});
