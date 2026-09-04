import type { OutputAction } from '../../output/conversation-output';

export interface VapiStreamWriter {
  write(chunk: string): void;
  end(): void;
}

export type VapiToolLike =
  | {
      type?: string;
      function?: { name?: string };
      name?: string;
    }
  | Record<string, unknown>;

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function extractToolFunctionNames(tools: unknown): string[] {
  if (!Array.isArray(tools)) {
    return [];
  }
  const names: string[] = [];
  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') {
      continue;
    }
    const t = tool as VapiToolLike;
    const fnObj =
      typeof t.function === 'object' && t.function
        ? (t.function as { name?: string })
        : null;
    const fnName =
      (fnObj && typeof fnObj.name === 'string' ? fnObj.name : null) ??
      (typeof t.name === 'string' ? t.name : null);
    if (fnName) {
      names.push(fnName);
    }
    // Built-in Vapi tool types often appear as type-only entries.
    if (typeof t.type === 'string' && ['endCall', 'transferCall', 'handoff'].includes(t.type)) {
      names.push(t.type);
    }
  }
  return [...new Set(names)];
}

export function resolveEndCallToolName(tools?: unknown): string {
  const advertised = extractToolFunctionNames(tools ?? []);
  const configured =
    process.env.VAPI_END_CALL_TOOL_NAME?.trim() || 'end_call_tool';

  if (advertised.includes(configured)) {
    return configured;
  }
  for (const candidate of ['end_call_tool', 'endCall', 'end_call']) {
    if (advertised.includes(candidate)) {
      return candidate;
    }
  }
  const fuzzy = advertised.find((n) => /end.*call/i.test(n));
  if (fuzzy) {
    return fuzzy;
  }
  // Force configured name even if Vapi omitted it from this request's tools list.
  return configured;
}

export function resolveTransferCallToolName(tools?: unknown): string {
  const advertised = extractToolFunctionNames(tools ?? []);
  const configured =
    process.env.VAPI_TRANSFER_CALL_TOOL_NAME?.trim() || 'transferCall';
  if (advertised.includes(configured)) {
    return configured;
  }
  if (advertised.includes('transferCall')) {
    return 'transferCall';
  }
  const fuzzy = advertised.find((n) => /transfer/i.test(n));
  return fuzzy ?? configured;
}

export function resolveHandoffToolName(
  tools?: unknown,
  assistantName?: string,
): string {
  const configured =
    process.env.VAPI_HANDOFF_TOOL_NAME?.trim() || 'handoff';
  const needle = assistantName?.trim();

  // Prefer a destination-specific tool (OpenAI multi-tool / handoff_to_<name> pattern).
  if (needle) {
    const matched = findHandoffToolNameForDestination(tools, needle);
    if (matched) return matched;
  }

  const advertised = extractToolFunctionNames(tools ?? []);
  if (advertised.includes(configured)) {
    return configured;
  }
  if (advertised.includes('handoff')) {
    return 'handoff';
  }
  const fuzzy = advertised.find((n) => /handoff/i.test(n));
  return fuzzy ?? configured;
}

/**
 * Vapi Squad handoff tool-call arguments.
 * `destination` MUST be a string (assistantName / assistantId enum value) —
 * not an object. See https://docs.vapi.ai/squads/handoff
 */
export function buildVapiHandoffToolArgs(input: {
  assistantName: string;
  reason?: string;
  payload?: Record<string, unknown>;
}): Record<string, unknown> {
  const destination = input.assistantName.trim();
  const args: Record<string, unknown> = { destination };
  if (input.reason?.trim()) {
    args.reason = input.reason.trim();
  }
  if (input.payload && Object.keys(input.payload).length > 0) {
    // Extra keys map to tool.function.parameters for variable extraction.
    for (const [key, value] of Object.entries(input.payload)) {
      if (key === 'destination') continue;
      args[key] = value;
    }
  }
  return args;
}

/** True when the Custom LLM request advertises at least one handoff tool. */
export function hasAdvertisedHandoffTool(tools?: unknown): boolean {
  return extractToolFunctionNames(tools ?? []).some((n) => /handoff/i.test(n));
}

function findHandoffToolNameForDestination(
  tools: unknown,
  assistantName: string,
): string | null {
  if (!Array.isArray(tools)) return null;
  const needle = assistantName.trim().toLowerCase();
  const slug = needle.replace(/[^a-z0-9]+/g, '_');

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue;
    const t = tool as Record<string, unknown>;
    const fn =
      typeof t.function === 'object' && t.function
        ? (t.function as Record<string, unknown>)
        : null;
    const fnName =
      (fn && typeof fn.name === 'string' ? fn.name : null) ??
      (typeof t.name === 'string' ? t.name : null);

    const destinations = Array.isArray(t.destinations) ? t.destinations : [];
    for (const dest of destinations) {
      if (!dest || typeof dest !== 'object') continue;
      const d = dest as Record<string, unknown>;
      const name =
        (typeof d.assistantName === 'string' && d.assistantName) ||
        (typeof d.assistantId === 'string' && d.assistantId) ||
        '';
      if (name.trim().toLowerCase() === needle && fnName) {
        return fnName;
      }
      if (name.trim().toLowerCase() === needle && t.type === 'handoff') {
        return fnName ?? 'handoff';
      }
    }

    // function.parameters.destination.enum includes this assistant
    const params =
      fn && typeof fn.parameters === 'object' && fn.parameters
        ? (fn.parameters as Record<string, unknown>)
        : null;
    const props =
      params && typeof params.properties === 'object' && params.properties
        ? (params.properties as Record<string, unknown>)
        : null;
    const destProp =
      props && typeof props.destination === 'object' && props.destination
        ? (props.destination as Record<string, unknown>)
        : null;
    const enumVals = Array.isArray(destProp?.enum) ? destProp!.enum : [];
    if (
      enumVals.some(
        (v) => typeof v === 'string' && v.trim().toLowerCase() === needle,
      ) &&
      fnName
    ) {
      return fnName;
    }

    if (
      fnName &&
      /handoff/i.test(fnName) &&
      (fnName.toLowerCase().includes(slug) ||
        fnName.toLowerCase().includes(needle.replace(/\s+/g, '')))
    ) {
      return fnName;
    }
  }
  return null;
}

/**
 * Compiles Vapi Studio output actions into OpenAI-compatible SSE for Vapi Custom LLM.
 */
export class VapiSseCompiler {
  private readonly model: string;
  private readonly id: string;
  private readonly tools: unknown;

  public constructor(opts?: { model?: string; id?: string; tools?: unknown }) {
    this.model = opts?.model ?? 'vapi-studio';
    this.id = opts?.id ?? `chatcmpl-${Date.now()}`;
    this.tools = opts?.tools;
  }

  /** Replay prior assistant utterances onto this SSE (coalesced waiter). */
  public replayAssistantSpeech(writer: VapiStreamWriter, texts: string[]): void {
    const spoken = texts.map((t) => t.trim()).filter(Boolean);
    if (spoken.length === 0) {
      this.writeAssistantText(writer, '');
      return;
    }
    for (const text of spoken) {
      this.writeAssistantText(writer, text);
    }
  }

  public writeAssistantText(writer: VapiStreamWriter, text: string): void {
    writer.write(
      sseData({
        id: this.id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: this.model,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: text },
            finish_reason: null,
          },
        ],
      }),
    );
  }

  public writeToolCall(
    writer: VapiStreamWriter,
    name: string,
    args: Record<string, unknown>,
    index = 0,
  ): void {
    const callId = `call_${name}_${Date.now()}_${index}`;
    // OpenAI-style streaming: announce tool call, then finalize with tool_calls.
    writer.write(
      sseData({
        id: this.id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: this.model,
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  index,
                  id: callId,
                  type: 'function',
                  function: {
                    name,
                    arguments: '',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }),
    );
    writer.write(
      sseData({
        id: this.id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: this.model,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index,
                  id: callId,
                  type: 'function',
                  function: {
                    arguments: JSON.stringify(args),
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }),
    );
    writer.write(
      sseData({
        id: this.id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: this.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'tool_calls',
          },
        ],
      }),
    );
  }

  /** Close stream after normal speech (no tool call). */
  public finish(writer: VapiStreamWriter): void {
    writer.write(
      sseData({
        id: this.id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: this.model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      }),
    );
    writer.write('data: [DONE]\n\n');
    writer.end();
  }

  /** Close stream after a tool call — do not emit finish_reason=stop. */
  public finishAfterToolCalls(writer: VapiStreamWriter): void {
    writer.write('data: [DONE]\n\n');
    writer.end();
  }

  public async streamTerminalActions(
    writer: VapiStreamWriter,
    actions: OutputAction[],
  ): Promise<{ emittedTools: string[] }> {
    let toolIndex = 0;
    const emittedTools: string[] = [];

    for (const action of actions) {
      if (action.kind === 'endCall') {
        const name = resolveEndCallToolName(this.tools);
        this.writeToolCall(writer, name, {}, toolIndex++);
        emittedTools.push(name);
      }
      if (action.kind === 'transferToHuman') {
        const name = resolveTransferCallToolName(this.tools);
        this.writeToolCall(
          writer,
          name,
          {
            destination:
              action.destination ?? process.env.VAPI_TRANSFER_DESTINATION,
          },
          toolIndex++,
        );
        emittedTools.push(name);
      }
      if (action.kind === 'handoff') {
        const assistantName =
          action.assistantName?.trim() ||
          action.handoffTo?.trim() ||
          '';
        const name = resolveHandoffToolName(this.tools, assistantName);
        this.writeToolCall(
          writer,
          name,
          buildVapiHandoffToolArgs({
            assistantName,
            reason: action.handoffReason,
            payload: action.handoffPayload,
          }),
          toolIndex++,
        );
        emittedTools.push(name);
      }
      if (action.kind === 'toolCall' && action.toolCall?.name) {
        const name = action.toolCall.name.trim();
        this.writeToolCall(
          writer,
          name,
          action.toolCall.arguments ?? {},
          toolIndex++,
        );
        emittedTools.push(name);
      }
    }

    if (emittedTools.length > 0) {
      this.finishAfterToolCalls(writer);
    } else {
      this.finish(writer);
    }
    return { emittedTools };
  }
}

export function extractNewestUserText(body: {
  messages?: Array<{ role?: string; content?: unknown }>;
}): string {
  const messages = body.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        return msg.content;
      }
      if (Array.isArray(msg.content)) {
        return msg.content
          .map((part) =>
            typeof part === 'object' && part && 'text' in part
              ? String((part as { text: string }).text)
              : '',
          )
          .join(' ')
          .trim();
      }
    }
  }
  return '';
}

export function extractVapiCallId(body: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    body.callId,
    body.call_id,
    (body.call as { id?: string } | undefined)?.id,
    (body.metadata as { callId?: string } | undefined)?.callId,
    (body.metadata as { call_id?: string } | undefined)?.call_id,
    ((body as { vapi?: { call?: { id?: string } } }).vapi?.call)?.id,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function extractVapiCallerNumber(
  body: Record<string, unknown> | null | undefined,
): string | null {
  if (!body || typeof body !== 'object') return null;
  const message =
    body.message && typeof body.message === 'object'
      ? (body.message as Record<string, unknown>)
      : body;
  const call = (message.call ?? body.call) as Record<string, unknown> | undefined;
  const customer = (call?.customer ??
    message.customer ??
    body.customer) as Record<string, unknown> | undefined;
  const candidates: unknown[] = [
    customer?.number,
    customer?.phoneNumber,
    customer?.phone,
    call?.from,
    (message as { from?: unknown }).from,
    (body as { from?: unknown }).from,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}
