import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  VapiSseCompiler,
  extractNewestUserText,
  extractVapiCallId,
  resolveEndCallToolName,
  buildVapiHandoffToolArgs,
} from '../dist/adapters/vapi/vapi-sse.compiler.js';
import {
  extractAdvertisedTools,
  extractToolResults,
  channelToolsApiFromList,
} from '../dist/channel/channel-tools.js';

function collect(run) {
  const chunks = [];
  const writer = {
    write: (c) => chunks.push(c),
    end: () => chunks.push('__END__'),
  };
  run(writer);
  return chunks.join('');
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

describe('VapiSseCompiler OpenAI-compatible SSE', () => {
  let prevEndCallName;

  beforeEach(() => {
    prevEndCallName = process.env.VAPI_END_CALL_TOOL_NAME;
    process.env.VAPI_END_CALL_TOOL_NAME = 'end_call_tool';
  });

  afterEach(() => {
    if (prevEndCallName === undefined) {
      delete process.env.VAPI_END_CALL_TOOL_NAME;
    } else {
      process.env.VAPI_END_CALL_TOOL_NAME = prevEndCallName;
    }
  });

  it('emits chat.completion.chunk assistant content frames', () => {
    const compiler = new VapiSseCompiler({ id: 'chatcmpl-test', model: 'studio-poc' });
    const raw = collect((w) => {
      compiler.writeAssistantText(w, 'Hello there');
      compiler.finish(w);
    });
    const events = parseSse(raw);
    assert.equal(events[0].object, 'chat.completion.chunk');
    assert.equal(events[0].model, 'studio-poc');
    assert.equal(events[0].choices[0].delta.role, 'assistant');
    assert.equal(events[0].choices[0].delta.content, 'Hello there');
    assert.equal(events[0].choices[0].finish_reason, null);
    assert.equal(events.at(-2).choices[0].finish_reason, 'stop');
    assert.equal(events.at(-1).done, true);
    assert.match(raw, /__END__/);
  });

  it('emits configured end_call_tool and does not follow with stop', async () => {
    const compiler = new VapiSseCompiler({
      id: 'chatcmpl-end',
      tools: [
        {
          type: 'function',
          function: { name: 'end_call_tool' },
        },
      ],
    });
    const chunks = [];
    const writer = {
      write: (c) => chunks.push(c),
      end: () => undefined,
    };
    const { emittedTools } = await compiler.streamTerminalActions(writer, [
      { kind: 'endCall', text: 'bye' },
    ]);
    assert.deepEqual(emittedTools, ['end_call_tool']);
    const events = parseSse(chunks.join(''));
    const tool = events.find((e) => e.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name);
    assert.ok(tool);
    assert.equal(
      tool.choices[0].delta.tool_calls[0].function.name,
      'end_call_tool',
    );
    const finish = events.find((e) => e.choices?.[0]?.finish_reason === 'tool_calls');
    assert.ok(finish);
    assert.equal(
      events.some((e) => e.choices?.[0]?.finish_reason === 'stop'),
      false,
    );
    assert.equal(events.at(-1).done, true);
  });

  it('emits transferCall tool with destination JSON args', async () => {
    const compiler = new VapiSseCompiler({ id: 'chatcmpl-xfer' });
    const chunks = [];
    const writer = {
      write: (c) => chunks.push(c),
      end: () => undefined,
    };
    await compiler.streamTerminalActions(writer, [
      { kind: 'transferToHuman', destination: '+15551234567' },
    ]);
    const events = parseSse(chunks.join(''));
    const named = events.find(
      (e) => e.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name === 'transferCall',
    );
    assert.ok(named);
    const withArgs = events.find((e) => {
      const args = e.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments;
      return typeof args === 'string' && args.includes('destination');
    });
    assert.ok(withArgs);
    assert.deepEqual(
      JSON.parse(withArgs.choices[0].delta.tool_calls[0].function.arguments),
      { destination: '+15551234567' },
    );
  });

  it('emits Squad handoff with destination as assistantName string', async () => {
    const compiler = new VapiSseCompiler({
      id: 'chatcmpl-handoff',
      tools: [
        {
          type: 'handoff',
          destinations: [
            { type: 'assistant', assistantName: 'StudioIdentity' },
          ],
          function: {
            name: 'handoff_to_StudioIdentity',
            parameters: {
              type: 'object',
              properties: {
                destination: {
                  type: 'string',
                  enum: ['StudioIdentity'],
                },
              },
              required: ['destination'],
            },
          },
        },
      ],
    });
    const chunks = [];
    const writer = {
      write: (c) => chunks.push(c),
      end: () => undefined,
    };
    const { emittedTools } = await compiler.streamTerminalActions(writer, [
      {
        kind: 'handoff',
        handoffTo: 'identity',
        assistantName: 'StudioIdentity',
        handoffReason: 'collect_identity',
      },
    ]);
    assert.deepEqual(emittedTools, ['handoff_to_StudioIdentity']);
    const events = parseSse(chunks.join(''));
    const withArgs = events.find((e) => {
      const args = e.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments;
      return typeof args === 'string' && args.includes('destination');
    });
    assert.ok(withArgs);
    const parsed = JSON.parse(
      withArgs.choices[0].delta.tool_calls[0].function.arguments,
    );
    assert.equal(typeof parsed.destination, 'string');
    assert.equal(parsed.destination, 'StudioIdentity');
    assert.equal(parsed.reason, 'collect_identity');
    assert.equal(parsed.destination?.type, undefined);
  });

  it('emits generic toolCall by advertised function name', async () => {
    const compiler = new VapiSseCompiler({
      id: 'chatcmpl-tool',
      tools: [
        {
          type: 'function',
          function: { name: 'send_sms_form' },
        },
      ],
    });
    const chunks = [];
    const writer = {
      write: (c) => chunks.push(c),
      end: () => undefined,
    };
    const { emittedTools } = await compiler.streamTerminalActions(writer, [
      {
        kind: 'toolCall',
        toolCall: {
          name: 'send_sms_form',
          arguments: { to: '+15551234567', formId: 1 },
        },
      },
    ]);
    assert.deepEqual(emittedTools, ['send_sms_form']);
    const events = parseSse(chunks.join(''));
    const named = events.find(
      (e) =>
        e.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name ===
        'send_sms_form',
    );
    assert.ok(named);
    const withArgs = events.find((e) => {
      const args = e.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments;
      return typeof args === 'string' && args.includes('formId');
    });
    assert.ok(withArgs);
    assert.deepEqual(
      JSON.parse(withArgs.choices[0].delta.tool_calls[0].function.arguments),
      { to: '+15551234567', formId: 1 },
    );
    const finish = events.find(
      (e) => e.choices?.[0]?.finish_reason === 'tool_calls',
    );
    assert.ok(finish);
  });

  it('resolves end call tool from advertised tools list', () => {
    assert.equal(
      resolveEndCallToolName([
        { type: 'function', function: { name: 'end_call_tool' } },
      ]),
      'end_call_tool',
    );
  });

  it('buildVapiHandoffToolArgs keeps destination a string', () => {
    assert.deepEqual(
      buildVapiHandoffToolArgs({
        assistantName: 'StudioRouter',
        payload: { firstName: 'Ada' },
      }),
      { destination: 'StudioRouter', firstName: 'Ada' },
    );
  });
});

describe('Vapi request helpers', () => {
  it('extracts newest user text from OpenAI messages', () => {
    assert.equal(
      extractNewestUserText({
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'ok' },
          { role: 'user', content: 'second' },
        ],
      }),
      'second',
    );
  });

  it('extracts Vapi call id from common body shapes', () => {
    assert.equal(extractVapiCallId({ call: { id: 'abc' } }), 'abc');
    assert.equal(extractVapiCallId({ callId: 'xyz' }), 'xyz');
    assert.equal(extractVapiCallId({ metadata: { call_id: 'm1' } }), 'm1');
    assert.equal(extractVapiCallId({}), null);
  });

  it('normalizes advertised tools for ctx.tools', () => {
    const tools = extractAdvertisedTools([
      {
        type: 'function',
        function: {
          name: 'lookupCustomer',
          description: 'CRM lookup',
          parameters: { type: 'object', properties: { phone: { type: 'string' } } },
        },
      },
      { type: 'endCall' },
      { type: 'function', function: { name: 'lookupCustomer' } },
    ]);
    assert.deepEqual(
      tools.map((t) => t.name),
      ['lookupCustomer', 'endCall'],
    );
    const api = channelToolsApiFromList(tools);
    assert.equal(api.has('lookupCustomer'), true);
    assert.equal(api.get('endCall')?.type, 'endCall');
  });

  it('parses role:tool results with names from prior tool_calls', () => {
    const results = extractToolResults({
      messages: [
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'lookupCustomer', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_1',
          content: '{"ok":true,"name":"Ada"}',
        },
      ],
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].toolCallId, 'call_1');
    assert.equal(results[0].name, 'lookupCustomer');
    assert.deepEqual(results[0].parsed, { ok: true, name: 'Ada' });
  });
});
