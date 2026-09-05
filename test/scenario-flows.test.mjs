/**
 * Planned call-flow proofs with MockBrain + mocked persistence.
 * No Postgres, no ChatGPT, no real secrets.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, mock } from 'node:test';
import { MockBrainService } from '../dist/brain/adapters/mock-brain.adapter.js';
import { SupervisedConversation } from '../dist/conversation/supervised-conversation.js';
import { FlowLoader } from '../dist/flow/flow-loader.js';
import { AgentNode } from '../dist/node/agent-node.js';
import { Supervisor } from '../dist/supervisor/supervisor.js';
import {
  VapiSseCompiler,
} from '../dist/adapters/vapi/vapi-sse.compiler.js';
import { STANDARD_INTENTIONS } from '../dist/intentions/standard-intentions.js';

class AcknowledgeNode extends AgentNode {
  async run(ctx) {
    const companyName = ctx.conversation?.variables?.companyName ?? 'Acme';
    return ctx.output.sayAndListen(
      `Hi, thanks for calling ${companyName}. What's your first name?`,
      {
        extract: {
          fields: [
            {
              key: 'firstName',
              type: 'string',
              required: true,
            },
          ],
          onExtracted: (data) => {
            if (typeof data.firstName === 'string') {
              ctx.memory.callerName = data.firstName;
            }
          },
        },
      },
    );
  }
}
class AlwaysRejectNode extends AgentNode {
  async before() {
    return false;
  }
  async run() {
    throw new Error('must not run');
  }
}
class MultiSayNode extends AgentNode {
  async run(ctx) {
    const name = ctx.memory?.callerName?.trim?.() ?? ctx.memory?.callerName;
    await ctx.output.say(
      name ? `Thanks, ${name}. Give me a moment.` : 'Okay, give me a moment.',
    );
    await ctx.output.say('Got it, I have some data for you.');
    return ctx.output.sayAndListen(
      'Here it is. This proves I can send multiple messages during one turn.',
    );
  }
}
class InterruptTestNode extends AgentNode {
  async run(ctx) {
    await ctx.output.say(
      'I am going to keep talking for a while so that you can interrupt me. Feel free to cut me off whenever you want.',
    );
    await ctx.output.say(
      'I am still talking on purpose, so we can observe how Vapi reports the interruption.',
    );
    return ctx.output.sayAndListen(
      'Interrupt window finished. Say anything and I will wrap up.',
    );
  }
}
class ContinueNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('Okay, continuing.');
  }
}
class GoodbyeNode extends AgentNode {
  async run(ctx) {
    return ctx.output.endCall('Thanks. I saw the interruption. Goodbye.');
  }
}
class PauseNode extends AgentNode {
  async run(ctx) {
    return ctx.output.sayAndListen('Sure, take your time. Okay?');
  }
}
class TransferToHumanNode extends AgentNode {
  async run(ctx) {
    const portal = ctx.runtime.portalState.transferToHuman;
    if (portal.reengagementAttempts < 1) {
      portal.reengagementAttempts += 1;
      return ctx.output.sayAndListen(
        'I understand you want to speak to a human, but I can resolve it for you.',
      );
    }
    await ctx.output.say('Connecting you to a human now.');
    return ctx.output.transferToHuman(process.env.VAPI_TRANSFER_DESTINATION);
  }
}

function mockEvents() {
  return {
    log: mock.fn(),
    persist: mock.fn(async () => undefined),
  };
}

function parseSse(raw) {
  const events = [];
  for (const part of raw.split('\n\n')) {
    const line = part.trim();
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6);
    if (data === '[DONE]') {
      events.push({ done: true });
      continue;
    }
    events.push(JSON.parse(data));
  }
  return events;
}

function contents(events) {
  return events
    .map((e) => e.choices?.[0]?.delta?.content)
    .filter((c) => typeof c === 'string' && c.length);
}

function toolNames(events) {
  return events.flatMap(
    (e) =>
      (e.choices?.[0]?.delta?.tool_calls ?? []).map((t) => t.function?.name),
  );
}

async function streamTurn(supervisor, runtime, userText) {
  const chunks = [];
  const compiler = new VapiSseCompiler({ id: `chatcmpl-${runtime.turn.turnNumber}` });
  const writer = {
    write: (c) => chunks.push(c),
    end: () => undefined,
  };
  const turn = await supervisor.handleTurn({
    runtime,
    userText,
    onSay: async (text) => compiler.writeAssistantText(writer, text),
  });
  await compiler.streamTerminalActions(writer, turn.actions);
  return { turn, events: parseSse(chunks.join('')) };
}

function buildSupervisor(brain) {
  const flow = new FlowLoader();
  flow.loadFromObject({
    version: 1,
    flow: { id: 'demo-app', start: 'acknowledge' },
    nodes: {
      acknowledge: {
        class: 'AcknowledgeNode',
        intentions: ['isAcknowledge'],
      },
      multiSayReject: {
        class: 'AlwaysRejectNode',
        priority: 50,
        intentions: ['isMultiSayTest'],
      },
      multiSay: {
        class: 'MultiSayNode',
        priority: 10,
        intentions: ['isMultiSayTest'],
      },
      interruptTest: {
        class: 'InterruptTestNode',
        intentions: ['isInterruptTest'],
      },
      continue: {
        class: 'ContinueNode',
        intentions: ['isContinue'],
      },
      goodbye: {
        class: 'GoodbyeNode',
        intentions: [STANDARD_INTENTIONS.isGoodbye],
        terminal: true,
      },
      pause: {
        class: 'PauseNode',
        portal: true,
        priority: 90,
        intentions: [STANDARD_INTENTIONS.isPause],
      },
      transferToHuman: {
        class: 'TransferToHumanNode',
        portal: true,
        priority: 100,
        intentions: [STANDARD_INTENTIONS.isTransferToHuman],
      },
    },
  });

  const nodes = new Map([
    ['AcknowledgeNode', new AcknowledgeNode()],
    ['AlwaysRejectNode', new AlwaysRejectNode()],
    ['MultiSayNode', new MultiSayNode()],
    ['InterruptTestNode', new InterruptTestNode()],
    ['ContinueNode', new ContinueNode()],
    ['GoodbyeNode', new GoodbyeNode()],
    ['PauseNode', new PauseNode()],
    ['TransferToHumanNode', new TransferToHumanNode()],
  ]);

  return new Supervisor(brain, flow, nodes, mockEvents());
}

describe('Scenario flows (MockBrain, mocked secrets)', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-mock-not-real';
    process.env.VAPI_TRANSFER_DESTINATION = '+15550001111';
    process.env.VAPI_WEBHOOK_SECRET = 'mock-secret';
    process.env.VAPI_END_CALL_TOOL_NAME = 'end_call_tool';
  });

  it('Scenario 1: acknowledge → multi-say → interrupt → goodbye/endCall', async () => {
    const brain = new MockBrainService();
    brain.setSequence('state-machine', [
      'isMultiSayTest',
      'isInterruptTest',
      STANDARD_INTENTIONS.isGoodbye,
    ]);
    brain.setActiveProfile('state-machine');
    const supervisor = buildSupervisor(brain);
    const runtime = new SupervisedConversation({
      conversationId: 'mock-conv-s1',
      providerCallId: 'mock-call-s1',
      flowId: 'demo-app',
      brainProfileId: 'state-machine',
      startNodeId: 'acknowledge',
      runtimeInstanceId: 'runtime-s1',
      variables: { companyName: 'Acme' },
    });

    // Opening: Vapi assistant-speaks-first — run flow.start, no Brain.
    const t0 = await streamTurn(supervisor, runtime, '');
    assert.equal(runtime.openingCompleted, true);
    assert.deepEqual(contents(t0.events), [
      "Hi, thanks for calling Acme. What's your first name?",
    ]);

    const t1 = await streamTurn(supervisor, runtime, 'My name is Mark');
    assert.equal(runtime.memory.callerName, 'Mark');
    assert.deepEqual(contents(t1.events), [
      'Thanks, Mark. Give me a moment.',
      'Got it, I have some data for you.',
      'Here it is. This proves I can send multiple messages during one turn.',
    ]);
    assert.equal(runtime.normalFlowNodeId, 'multiSay');

    const t2 = await streamTurn(supervisor, runtime, 'go on');
    assert.equal(t2.turn.selectedNodeId, 'interruptTest');
    assert.ok(
      contents(t2.events)[0].includes('keep talking for a while'),
    );

    const t3 = await streamTurn(supervisor, runtime, 'okay bye');
    assert.ok(
      contents(t3.events).includes('Thanks. I saw the interruption. Goodbye.'),
    );
    assert.ok(
      toolNames(t3.events).includes(
        process.env.VAPI_END_CALL_TOOL_NAME || 'end_call_tool',
      ),
    );
    assert.equal(runtime.runtimeInstanceId, 'runtime-s1');
  });

  it('pause-resume profile: portal origin preserved then continue', async () => {
    const brain = new MockBrainService();
    brain.setSequence('pause-resume', [
      'isMultiSayTest',
      STANDARD_INTENTIONS.isPause,
      'isContinue',
      // Re-scan of the same utterance after silent portal exit (no filler say).
      'isMultiSayTest',
      STANDARD_INTENTIONS.isGoodbye,
    ]);
    brain.setActiveProfile('pause-resume');
    const supervisor = buildSupervisor(brain);
    const runtime = new SupervisedConversation({
      conversationId: 'mock-conv-pause',
      providerCallId: 'mock-call-pause',
      flowId: 'demo-app',
      brainProfileId: 'pause-resume',
      startNodeId: 'acknowledge',
      runtimeInstanceId: 'runtime-pause',
    });

    await streamTurn(supervisor, runtime, ''); // opening
    await streamTurn(supervisor, runtime, 'multi');
    const t3 = await streamTurn(supervisor, runtime, 'wait a second');
    assert.deepEqual(contents(t3.events), ['Sure, take your time. Okay?']);
    assert.equal(runtime.portalState.activePortalId, 'pause');
    assert.equal(runtime.portalState.originNodeId, 'multiSay');

    const t4 = await streamTurn(supervisor, runtime, 'okay continue');
    assert.equal(runtime.portalState.activePortalId, null);
    assert.equal(t4.turn.selectedNodeId, 'multiSay');
    // Must not speak filler “Okay, continuing.” — origin node speaks instead.
    assert.ok(!contents(t4.events).includes('Okay, continuing.'));
    assert.ok(
      contents(t4.events).some((c) => c.includes('Give me a moment')),
    );
  });

  it('Scenario 2: transfer re-engage then transferCall tool', async () => {
    const brain = new MockBrainService();
    brain.setSequence('transfer-human', [
      STANDARD_INTENTIONS.isTransferToHuman,
      STANDARD_INTENTIONS.isTransferToHuman,
    ]);
    brain.setActiveProfile('transfer-human');
    const supervisor = buildSupervisor(brain);
    const runtime = new SupervisedConversation({
      conversationId: 'mock-conv-s2',
      providerCallId: 'mock-call-s2',
      flowId: 'demo-app',
      brainProfileId: 'transfer-human',
      startNodeId: 'acknowledge',
      runtimeInstanceId: 'runtime-s2',
    });

    await streamTurn(supervisor, runtime, ''); // opening intro
    const x1 = await streamTurn(supervisor, runtime, 'human please');
    assert.deepEqual(contents(x1.events), [
      'I understand you want to speak to a human, but I can resolve it for you.',
    ]);
    assert.equal(toolNames(x1.events).includes('transferCall'), false);
    assert.equal(runtime.portalState.activePortalId, 'transferToHuman');
    assert.equal(runtime.portalState.transferToHuman.reengagementAttempts, 1);

    const x2 = await streamTurn(supervisor, runtime, 'human again');
    assert.ok(contents(x2.events).includes('Connecting you to a human now.'));
    assert.ok(toolNames(x2.events).includes('transferCall'));
    const withArgs = x2.events.find((e) => {
      const args = e.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments;
      return typeof args === 'string' && args.includes('destination');
    });
    assert.ok(withArgs);
    assert.deepEqual(
      JSON.parse(withArgs.choices[0].delta.tool_calls[0].function.arguments),
      { destination: '+15550001111' },
    );
  });
});
