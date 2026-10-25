import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { MockBrainAdapter } from '../dist/brain/adapters/mock-brain.adapter.js';
import {
  ClarifyCannotAnswerError,
  clarifiableInputToString,
  filterClarifyAnswer,
  isClarifyCannotAnswerError,
  normalizeClarifyResult,
  STUDIO_CLARIFY_CANNOT_ANSWER,
} from '../dist/brain/brain-clarify.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import {
  FlowUncertainError,
  forceIntention,
  restartNode,
} from '../dist/node/catch-directive.js';
import { AgentNode } from '../dist/node/agent-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';
import { STANDARD_INTENTIONS } from '../dist/intentions/standard-intentions.js';
import { routeBrainLlm } from '../dist/brain/brain-config.js';

describe('Brain clarify', () => {
  it('stringifies clarifiable input', () => {
    assert.equal(clarifiableInputToString('hi'), 'hi');
    assert.equal(clarifiableInputToString(42), '42');
    assert.equal(clarifiableInputToString(true), 'true');
    assert.equal(clarifiableInputToString(null), '');
  });

  it('MockBrain.clarify returns object answer for fields', async () => {
    const brain = new MockBrainAdapter();
    const result = await brain.clarify({
      input: 'My name is Ada',
      question: 'What is the first name?',
      answer: {
        fields: [
          { key: 'firstName', type: 'string', required: true },
          { key: 'confident', type: 'boolean', required: true },
        ],
      },
    });
    assert.equal(typeof result.answer, 'object');
    assert.equal(result.answer.firstName, 'Ada');
    assert.equal(typeof result.answer.confident, 'boolean');
    assert.deepEqual(
      filterClarifyAnswer({ firstName: 'Ada', extra: 1 }, {
        fields: [{ key: 'firstName' }],
      }),
      { firstName: 'Ada' },
    );
  });

  it('throws reserved ClarifyCannotAnswerError when Brain cannot answer', async () => {
    const brain = new MockBrainAdapter();
    await assert.rejects(
      () =>
        brain.clarify({
          input: '',
          question: 'What is the first name?',
          answer: {
            fields: [{ key: 'firstName', type: 'string', required: true }],
          },
        }),
      (err) => {
        assert.ok(isClarifyCannotAnswerError(err));
        assert.equal(err.code, STUDIO_CLARIFY_CANNOT_ANSWER);
        return true;
      },
    );

    await assert.rejects(
      () =>
        brain.clarify({
          input: 'studio.clarify.cannotAnswer',
          question: 'What is the first name?',
          answer: {
            fields: [{ key: 'firstName', type: 'string', required: true }],
          },
        }),
      ClarifyCannotAnswerError,
    );

    assert.throws(
      () =>
        normalizeClarifyResult(
          { outcome: STUDIO_CLARIFY_CANNOT_ANSWER, reason: 'ambiguous' },
          { fields: [{ key: 'firstName', required: true }] },
        ),
      (err) => {
        assert.ok(isClarifyCannotAnswerError(err));
        assert.equal(err.reason, 'ambiguous');
        return true;
      },
    );
  });
});

describe('Node catch recovery', () => {
  it('forceIntention routes to another node after FlowUncertainError', async () => {
    class UncertainNode extends AgentNode {
      async run() {
        throw new FlowUncertainError('not sure');
      }
      async catch() {
        return forceIntention('isContinue');
      }
    }
    class ContinueNode extends AgentNode {
      async run(ctx) {
        return ctx.output.sayAndListen('Recovered via forceIntention.');
      }
    }

    const brain = new MockBrainAdapter();
    brain.setSequence('catch-force', ['isUncertain']);
    brain.setActiveProfile('catch-force');

    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'catch-demo', start: 'uncertain' },
      nodes: {
        uncertain: {
          class: 'UncertainNode',
          intentions: ['isUncertain'],
        },
        continue: {
          class: 'ContinueNode',
          intentions: ['isContinue'],
        },
      },
    });

    const supervisor = new Supervisor(
      brain,
      flow,
      new Map([
        ['UncertainNode', new UncertainNode()],
        ['ContinueNode', new ContinueNode()],
      ]),
      { log: mock.fn(), persist: mock.fn(async () => undefined) },
    );

    const runtime = new SupervisedConversation({
      conversationId: 'c-force',
      providerCallId: 'p-force',
      flowId: 'catch-demo',
      brainProfileId: 'catch-force',
      startNodeId: 'uncertain',
    });

    const turn = await supervisor.handleTurn({
      runtime,
      userText: 'hmm',
    });
    assert.equal(turn.selectedNodeId, 'continue');
    assert.equal(turn.result.text, 'Recovered via forceIntention.');
  });

  it('restartNode re-runs the same node', async () => {
    let attempts = 0;
    class FlakyNode extends AgentNode {
      async run(ctx) {
        attempts += 1;
        if (attempts === 1) {
          throw new FlowUncertainError('try again');
        }
        return ctx.output.sayAndListen(`ok after ${attempts}`);
      }
      async catch() {
        return restartNode();
      }
    }

    const brain = new MockBrainAdapter();
    brain.setSequence('catch-restart', ['isFlaky']);
    brain.setActiveProfile('catch-restart');

    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'restart-demo', start: 'flaky' },
      nodes: {
        flaky: {
          class: 'FlakyNode',
          intentions: ['isFlaky'],
        },
      },
    });

    const supervisor = new Supervisor(
      brain,
      flow,
      new Map([['FlakyNode', new FlakyNode()]]),
      { log: mock.fn(), persist: mock.fn(async () => undefined) },
    );

    const runtime = new SupervisedConversation({
      conversationId: 'c-restart',
      providerCallId: 'p-restart',
      flowId: 'restart-demo',
      brainProfileId: 'catch-restart',
      startNodeId: 'flaky',
    });

    const turn = await supervisor.handleTurn({
      runtime,
      userText: 'go',
    });
    assert.equal(attempts, 2);
    assert.equal(turn.result.text, 'ok after 2');
    assert.ok(STANDARD_INTENTIONS.isUnknownTransition);
  });

  it('a before() error reaches catch(): the Node routes back to re-ask', async () => {
    class AskPhoneNode extends AgentNode {
      async run(ctx) {
        const retry = ctx.memory.phoneProblem;
        return ctx.output.sayAndListen(
          retry ? `I caught ${retry}. What is the full number?` : 'What is your phone number?',
        );
      }
    }
    class UsePhoneNode extends AgentNode {
      async before(ctx) {
        const digits = ctx.userText.replace(/\D/g, '');
        if (digits.length !== 10) {
          throw new FlowUncertainError('phone needs 10 digits', { digits });
        }
        ctx.memory.phone = digits;
        return true;
      }
      async run(ctx) {
        return ctx.output.sayAndListen(`Thanks, saved ${ctx.memory.phone}.`);
      }
      async catch(ctx, error) {
        ctx.memory.phoneProblem = error.details?.digits;
        return forceIntention('isRetryPhone');
      }
    }

    const brain = new MockBrainAdapter();
    brain.setSequence('before-catch', ['isCollectedPhone']);
    brain.setActiveProfile('before-catch');
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'before-catch', start: 'askPhone' },
      nodes: {
        askPhone: { class: 'AskPhoneNode', intentions: ['isRetryPhone'] },
        usePhone: { class: 'UsePhoneNode', intentions: ['isCollectedPhone'] },
      },
    });
    const supervisor = new Supervisor(
      brain,
      flow,
      new Map([
        ['AskPhoneNode', new AskPhoneNode()],
        ['UsePhoneNode', new UsePhoneNode()],
      ]),
      { log: mock.fn(), persist: mock.fn(async () => undefined) },
    );
    const runtime = new SupervisedConversation({
      conversationId: 'c-before',
      providerCallId: 'p-before',
      flowId: 'before-catch',
      brainProfileId: 'before-catch',
      startNodeId: 'askPhone',
    });

    const opening = await supervisor.handleTurn({ runtime, userText: '' });
    assert.equal(opening.result.text, 'What is your phone number?');
    const turn = await supervisor.handleTurn({ runtime, userText: '416 555 01' });
    assert.equal(turn.selectedNodeId, 'askPhone');
    assert.equal(turn.result.text, 'I caught 41655501. What is the full number?');
    assert.equal(runtime.memory.phone, undefined);
  });

  it('a before() error with the default catch() breaks the turn', async () => {
    class StrictNode extends AgentNode {
      async before() {
        throw new Error('node expectations breached');
      }
      async run() {
        throw new Error('must not run');
      }
    }
    const brain = new MockBrainAdapter();
    brain.setSequence('before-rethrow', ['isStrict']);
    brain.setActiveProfile('before-rethrow');
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 'before-rethrow', start: 'strict' },
      nodes: { strict: { class: 'StrictNode', intentions: ['isStrict'] } },
    });
    const supervisor = new Supervisor(
      brain,
      flow,
      new Map([['StrictNode', new StrictNode()]]),
      { log: mock.fn(), persist: mock.fn(async () => undefined) },
    );
    const runtime = new SupervisedConversation({
      conversationId: 'c-rethrow',
      providerCallId: 'p-rethrow',
      flowId: 'before-rethrow',
      brainProfileId: 'before-rethrow',
      startNodeId: 'strict',
    });
    await assert.rejects(
      supervisor.handleTurn({ runtime, userText: 'hi' }),
      /node expectations breached/,
    );
  });
});

describe('brain.llm routing', () => {
  it('scans stay on the scanner; clarify / judge go to brain.llm', async () => {
    const calls = [];
    const scanner = {
      scan: async () => (calls.push('scan'), { intentions: [] }),
      clarify: async () => (calls.push('scanner.clarify'), { answer: {} }),
      judge: async () => (calls.push('scanner.judge'), { passed: false }),
    };
    const llm = {
      scan: async () => (calls.push('llm.scan'), { intentions: [] }),
      clarify: async () => (calls.push('llm.clarify'), { answer: {} }),
      judge: async () => (calls.push('llm.judge'), { passed: true }),
    };
    const brain = routeBrainLlm(scanner, llm);
    await brain.scan({});
    await brain.clarify({});
    await brain.judge({});
    assert.deepEqual(calls, ['scan', 'llm.clarify', 'llm.judge']);
    assert.equal(routeBrainLlm(scanner, null), scanner);
  });
});
