/**
 * Unknown portal must consume a restatement against the origin listen
 * (unknown_origin_consume) instead of routing via unknown’s thin candidates.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { MockBrainService } from '../dist/brain/adapters/mock-brain.adapter.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import { AgentNode } from '../dist/node/agent-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';
import { STANDARD_INTENTIONS } from '../dist/intentions/standard-intentions.js';
import { ROUTE_RESOLVED_VIA } from '../dist/intention/intention-constants.js';

class OriginNode extends AgentNode {
  async listen() {
    return {
      intentions: [{ name: 'isRequestedAppointment', boost: 20 }],
      resolveIntention: ({ userText }) =>
        /\basap\b|as soon as possible/i.test(userText)
          ? 'isRequestedAppointment'
          : null,
    };
  }
  async run(ctx) {
    return ctx.output.sayAndListen('What day or time works best for you?');
  }
}

class CheckAvailNode extends AgentNode {
  async before() {
    return true;
  }
  async listen() {
    return { intentions: [{ name: 'isRequestedAppointment', boost: 20 }] };
  }
  async run(ctx) {
    return ctx.output.sayAndListen(`Got ASAP: ${ctx.userText}`);
  }
}

class UnknownNode extends AgentNode {
  async listen() {
    return {
      intentions: [
        { name: 'isRequestedRoofEstimate', boost: 14 },
        { name: 'isContinue', boost: 8 },
      ],
    };
  }
  async run(ctx) {
    return ctx.output.sayAndListen(
      "Sorry — I didn't quite catch that. Could you say it one more time?",
    );
  }
}

class AcknowledgeNode extends AgentNode {
  async listen() {
    return { intentions: [{ name: 'isRequestedRoofEstimate', boost: 20 }] };
  }
  async run(ctx) {
    return ctx.output.sayAndListen('hi');
  }
}

function mockEvents() {
  const events = [];
  return {
    events,
    log(_level, type, payload) {
      events.push({ type, payload });
    },
    async persist(_id, type, payload) {
      events.push({ type, payload });
    },
  };
}

function mockBootstrap() {
  return {
    async checkpoint() {},
  };
}

function buildSupervisor(brain, events) {
  const flow = new FlowLoader();
  flow.loadFromObject({
    version: 1,
    flow: { id: 'unknown-consume', start: 'origin' },
    nodes: {
      origin: {
        class: 'OriginNode',
        intentions: ['isOrigin'],
      },
      checkAvail: {
        class: 'CheckAvailNode',
        intentions: ['isRequestedAppointment'],
      },
      unknownTransition: {
        class: 'UnknownNode',
        portal: true,
        priority: 80,
        intentions: [STANDARD_INTENTIONS.isUnknownTransition],
      },
      acknowledge: {
        class: 'AcknowledgeNode',
        intentions: ['isRequestedRoofEstimate'],
      },
    },
  });

  const nodes = new Map([
    ['OriginNode', new OriginNode()],
    ['CheckAvailNode', new CheckAvailNode()],
    ['UnknownNode', new UnknownNode()],
    ['AcknowledgeNode', new AcknowledgeNode()],
  ]);

  return new Supervisor(brain, flow, nodes, events, mockBootstrap());
}

describe('Unknown origin consume', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-mock';
  });

  it('consumes ASAP against origin listen while in unknown portal', async () => {
    const events = mockEvents();
    const brain = new MockBrainService();
    brain.setSequence('default', ['isRequestedRoofEstimate']);
    const supervisor = buildSupervisor(brain, events);

    const runtime = new SupervisedConversation({
      conversationId: 'c-unknown-consume',
      providerCallId: 'call-1',
      flowId: 'unknown-consume',
      brainProfileId: 'default',
      startNodeId: 'origin',
    });
    runtime.openingCompleted = true;
    runtime.currentNodeId = 'origin';
    runtime.normalFlowNodeId = 'origin';
    runtime.listenExpectation = await new OriginNode().listen();

    runtime.enterPortal('unknownTransition');
    runtime.listenExpectation = await new UnknownNode().listen();

    const turn = await supervisor.handleTurn({
      runtime,
      userText: 'as soon as possible',
    });

    assert.equal(turn.selectedClass, 'CheckAvailNode');
    assert.equal(turn.result.kind, 'sayAndListen');
    assert.match(String(turn.result.text ?? ''), /Got ASAP/i);
    assert.equal(runtime.portalState.activePortalId, null);

    const consume = events.events.find((e) => e.type === 'UNKNOWN_ORIGIN_CONSUME');
    assert.ok(consume, 'expected UNKNOWN_ORIGIN_CONSUME event');
    assert.equal(consume.payload.resolvedName, 'isRequestedAppointment');

    const decision = events.events.find((e) => e.type === 'ROUTE_DECISION');
    assert.ok(decision);
    assert.equal(
      decision.payload.resolvedVia,
      ROUTE_RESOLVED_VIA.UnknownOriginConsume,
    );
  });
});
