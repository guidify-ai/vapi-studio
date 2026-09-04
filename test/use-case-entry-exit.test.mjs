/**
 * Use-case entry/exit: continueTo jumps + module entry-speak (no re-opening).
 * Conversation beforeEach/afterEach covered in bootstrap-conversation.test.mjs.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, mock } from 'node:test';
import { MockBrainService } from '../dist/brain/adapters/mock-brain.adapter.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import { AgentNode } from '../dist/node/agent-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';
import { WorkflowHandoffService } from '../dist/workflow/workflow-handoff.service.js';
import { WorkflowLoader } from '../dist/workflow/workflow-loader.js';

class StepANode extends AgentNode {
  async run(ctx) {
    return ctx.output.continueTo({
      nodeId: 'stepB',
      reason: 'advance_use_case',
    });
  }
}

class StepBNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('Now on step B — what is your email?');
  }
}

class OpeningNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('Opening greeting.');
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

describe('Use-case entry/exit (continueTo + module entry speak)', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-mock-not-real';
  });

  it('continueTo marks entry-speak; next turn runs destination without re-opening', async () => {
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'use-case', start: 'opening' },
      nodes: {
        opening: { class: 'OpeningNode', intentions: ['isOpening'] },
        stepA: { class: 'StepANode', intentions: ['isStepA'] },
        stepB: { class: 'StepBNode', intentions: ['isStepB'] },
      },
    });
    const nodes = new Map([
      ['OpeningNode', new OpeningNode()],
      ['StepANode', new StepANode()],
      ['StepBNode', new StepBNode()],
    ]);
    const events = mockEvents();
    const bootstrap = mockBootstrap();
    const brain = new MockBrainService();
    brain.setSequence('state-machine', ['isStepA']);
    brain.setActiveProfile('state-machine');
    const supervisor = new Supervisor(brain, flow, nodes, events, bootstrap);
    const handoffs = new WorkflowHandoffService(
      new WorkflowLoader(),
      flow,
      events,
      bootstrap,
    );

    const runtime = new SupervisedConversation({
      conversationId: 'c-uc-1',
      providerCallId: 'p-uc-1',
      flowId: 'use-case',
      brainProfileId: 'state-machine',
      startNodeId: 'opening',
    });

    const open = await supervisor.handleTurn({ runtime, userText: '' });
    assert.equal(open.result.kind, 'sayAndListen');
    assert.equal(runtime.openingCompleted, true);
    assert.equal(runtime.currentNodeId, 'opening');

    // Jump into step A via Brain, which emits continueTo → step B.
    const t1 = await supervisor.handleTurn({
      runtime,
      userText: 'go next',
    });
    assert.equal(t1.selectedNodeId, 'stepA');
    assert.equal(t1.result.kind, 'continueTo');
    assert.equal(t1.result.continueToNodeId, 'stepB');

    const after = await handoffs.applyHandoffs(runtime, t1.actions);
    assert.equal(after[0].kind, 'continueTo');
    assert.equal(runtime.currentNodeId, 'stepB');
    assert.equal(runtime.metadata.moduleNeedsEntrySpeak, true);
    assert.equal(runtime.openingCompleted, true);
    assert.ok(
      events.persist.mock.calls.some((c) => c.arguments[1] === 'FLOW_CONTINUE'),
    );

    // Next Custom LLM / studio turn speaks step B entry — not opening again.
    const t2 = await supervisor.handleTurn({ runtime, userText: '' });
    assert.equal(runtime.metadata.moduleNeedsEntrySpeak, false);
    assert.equal(runtime.openingCompleted, true);
    assert.equal(t2.selectedNodeId, 'stepB');
    assert.equal(t2.result.kind, 'sayAndListen');
    assert.match(String(t2.result.text), /step B/i);
    assert.ok(!String(t2.result.text).includes('Opening greeting'));
  });

  it('module entry speak does not require Brain scan of empty text', async () => {
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'use-case-2', start: 'stepB' },
      nodes: {
        stepB: { class: 'StepBNode', intentions: ['isStepB'] },
      },
    });
    const nodes = new Map([['StepBNode', new StepBNode()]]);
    const brain = new MockBrainService();
    // Empty profile — would throw if Brain scanned.
    brain.setSequence('state-machine', ['unused']);
    brain.setActiveProfile('state-machine');
    const supervisor = new Supervisor(
      brain,
      flow,
      nodes,
      mockEvents(),
      mockBootstrap(),
    );
    const runtime = new SupervisedConversation({
      conversationId: 'c-uc-2',
      providerCallId: 'p-uc-2',
      flowId: 'use-case-2',
      brainProfileId: 'state-machine',
      startNodeId: 'stepB',
    });
    runtime.openingCompleted = true;
    runtime.metadata.moduleNeedsEntrySpeak = true;

    const turn = await supervisor.handleTurn({ runtime, userText: '' });
    assert.equal(turn.selectedNodeId, 'stepB');
    assert.equal(turn.result.kind, 'sayAndListen');
    assert.equal(runtime.metadata.moduleNeedsEntrySpeak, false);
  });
});
