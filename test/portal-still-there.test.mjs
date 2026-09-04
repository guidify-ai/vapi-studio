/**
 * Still-there portal: force-only enter, positive/continue exits to origin,
 * Brain must not promote filler into still-there mid-flow, ask×2 then endCall.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, mock } from 'node:test';
import { MockBrainService } from '../dist/brain/adapters/mock-brain.adapter.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import { Ra9Node } from '../dist/node/ra9-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';
import { STANDARD_INTENTIONS } from '../dist/intentions/standard-intentions.js';

class OriginNode extends Ra9Node {
  async listen() {
    return {
      intentions: [{ name: 'isOriginContinue', boost: 20 }],
      resolveIntention: ({ userText }) =>
        /\byes\b|still here/i.test(userText) ? 'isOriginContinue' : null,
    };
  }
  async run(ctx) {
    return ctx.output.sayAndListen('What is your first name?');
  }
}

class OriginContinueNode extends Ra9Node {
  async run(ctx) {
    return ctx.output.sayAndListen(`Resumed with: ${ctx.userText}`);
  }
}

class StillThereNode extends Ra9Node {
  async run(ctx) {
    const portal = ctx.runtime.portalState.stillThere;
    portal.attempts += 1;
    if (portal.attempts >= 2) {
      return ctx.output.endCall(
        "I haven't heard from you, so I'll end the call. Goodbye.",
      );
    }
    return ctx.output.sayAndListen('Are you still there?');
  }
}

function mockEvents() {
  return {
    log: mock.fn(),
    persist: mock.fn(async () => undefined),
  };
}

function mockBootstrap() {
  return {
    checkpoint: mock.fn(async () => undefined),
  };
}

function buildSupervisor(brain, events = mockEvents()) {
  const flow = new FlowLoader();
  flow.loadFromObject({
    version: 1,
    flow: { id: 'still-there-test', start: 'origin' },
    nodes: {
      origin: {
        class: 'OriginNode',
        intentions: ['isOpening'],
      },
      originContinue: {
        class: 'OriginContinueNode',
        intentions: ['isOriginContinue'],
      },
      stillThere: {
        class: 'StillThereNode',
        portal: true,
        priority: 95,
        intentions: [
          STANDARD_INTENTIONS.isStillThere,
          STANDARD_INTENTIONS.isPositive,
          'isContinue',
        ],
      },
    },
  });
  const nodes = new Map([
    ['OriginNode', new OriginNode()],
    ['OriginContinueNode', new OriginContinueNode()],
    ['StillThereNode', new StillThereNode()],
  ]);
  return new Supervisor(brain, flow, nodes, events, mockBootstrap());
}

describe('Portal still-there enter/exit', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-mock-not-real';
  });

  it('forceIntention enters still-there and preserves origin', async () => {
    const brain = new MockBrainService();
    brain.setSequence('state-machine', ['isOriginContinue']);
    brain.setActiveProfile('state-machine');
    const events = mockEvents();
    const supervisor = buildSupervisor(brain, events);
    const runtime = new SupervisedConversation({
      conversationId: 'c-st-1',
      providerCallId: 'p-st-1',
      flowId: 'still-there-test',
      brainProfileId: 'state-machine',
      startNodeId: 'origin',
    });

    const open = await supervisor.handleTurn({ runtime, userText: '' });
    assert.equal(open.result.kind, 'sayAndListen');
    assert.equal(runtime.openingCompleted, true);
    assert.equal(runtime.normalFlowNodeId, 'origin');

    const idle = await supervisor.handleTurn({
      runtime,
      userText: '',
      forceIntention: STANDARD_INTENTIONS.isStillThere,
    });
    assert.equal(idle.selectedNodeId, 'stillThere');
    assert.equal(idle.result.kind, 'sayAndListen');
    assert.equal(idle.result.text, 'Are you still there?');
    assert.equal(runtime.portalState.activePortalId, 'stillThere');
    assert.equal(runtime.portalState.originNodeId, 'origin');
    assert.equal(runtime.portalState.stillThere.attempts, 1);
    assert.ok(
      events.log.mock.calls.some((c) => c.arguments[1] === 'PORTAL_ENTER'),
    );
  });

  it('Brain cannot promote filler into still-there mid-flow', async () => {
    const brain = new MockBrainService();
    brain.setSequence('state-machine', [STANDARD_INTENTIONS.isStillThere]);
    brain.setActiveProfile('state-machine');
    const events = mockEvents();
    const supervisor = buildSupervisor(brain, events);
    const runtime = new SupervisedConversation({
      conversationId: 'c-st-2',
      providerCallId: 'p-st-2',
      flowId: 'still-there-test',
      brainProfileId: 'state-machine',
      startNodeId: 'origin',
    });

    await supervisor.handleTurn({ runtime, userText: '' });
    // Mid-flow filler — Brain returns isStillThere; Supervisor must reject.
    await assert.rejects(
      () => supervisor.handleTurn({ runtime, userText: 'hey?' }),
      /could not route|eligible node/i,
    );
    assert.equal(runtime.portalState.activePortalId, null);
    assert.equal(runtime.normalFlowNodeId, 'origin');
  });

  it('positive reply while in still-there Continue-replays origin listen', async () => {
    const brain = new MockBrainService();
    // After silent portal exit, same utterance is re-scanned against origin.
    brain.setSequence('state-machine', [
      STANDARD_INTENTIONS.isPositive,
      'isOriginContinue',
    ]);
    brain.setActiveProfile('state-machine');
    const supervisor = buildSupervisor(brain);
    const runtime = new SupervisedConversation({
      conversationId: 'c-st-3',
      providerCallId: 'p-st-3',
      flowId: 'still-there-test',
      brainProfileId: 'state-machine',
      startNodeId: 'origin',
    });

    await supervisor.handleTurn({ runtime, userText: '' });
    await supervisor.handleTurn({
      runtime,
      userText: '',
      forceIntention: STANDARD_INTENTIONS.isStillThere,
    });
    assert.equal(runtime.portalState.activePortalId, 'stillThere');

    // Origin listen snapshot is captured on portal enter from opening sayAndListen.
    assert.ok(runtime.portalState.originListenExpectation);

    const resumed = await supervisor.handleTurn({
      runtime,
      userText: 'yes still here',
    });
    assert.equal(runtime.portalState.activePortalId, null);
    assert.equal(runtime.portalState.stillThere.attempts, 0);
    assert.equal(resumed.selectedNodeId, 'originContinue');
    assert.match(String(resumed.result.text), /Resumed with: yes still here/i);
  });

  it('second still-there ask ends the call', async () => {
    const brain = new MockBrainService();
    brain.setSequence('state-machine', [
      STANDARD_INTENTIONS.isStillThere,
      STANDARD_INTENTIONS.isStillThere,
    ]);
    brain.setActiveProfile('state-machine');
    const supervisor = buildSupervisor(brain);
    const runtime = new SupervisedConversation({
      conversationId: 'c-st-4',
      providerCallId: 'p-st-4',
      flowId: 'still-there-test',
      brainProfileId: 'state-machine',
      startNodeId: 'origin',
    });

    await supervisor.handleTurn({ runtime, userText: '' });
    const ask1 = await supervisor.handleTurn({
      runtime,
      userText: '',
      forceIntention: STANDARD_INTENTIONS.isStillThere,
    });
    assert.equal(ask1.result.kind, 'sayAndListen');
    assert.equal(runtime.portalState.stillThere.attempts, 1);

    const ask2 = await supervisor.handleTurn({
      runtime,
      userText: '',
      forceIntention: STANDARD_INTENTIONS.isStillThere,
    });
    assert.equal(ask2.result.kind, 'endCall');
    assert.equal(runtime.portalState.stillThere.attempts, 2);
    assert.match(String(ask2.result.text), /end the call/i);
  });
});
