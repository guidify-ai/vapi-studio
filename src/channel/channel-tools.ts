/**
 * Optional tool ads from the channel (e.g. Vapi Custom LLM `body.tools`).
 *
 * Convention: Vapi Studio requests tools **by name** assuming the Vapi assistant was
 * pre-provisioned with them. This snapshot is visibility for operators / soft
 * warnings — not a required inventory gate, and not shared sync state.
 */

export interface ChannelTool {
  name: string;
  description?: string;
  /** JSON Schema-ish parameters when present on the advertisement. */
  parameters?: Record<string, unknown>;
  /** Raw provider type when known (`function`, `handoff`, `endCall`, …). */
  type?: string;
}

export interface ChannelToolResult {
  /** Provider tool_call id when present. */
  toolCallId?: string;
  /** Function name when recoverable from prior assistant tool_calls. */
  name?: string;
  /** Raw content string from the tool message. */
  content: string;
  /** Best-effort JSON parse of content. */
  parsed?: unknown;
}

export interface ChannelToolsApi {
  list(): ChannelTool[];
  has(name: string): boolean;
  get(name: string): ChannelTool | undefined;
}

export interface VapiTurnContext {
  callId: string | null;
  assistantId?: string | null;
  phoneNumber?: string | null;
  customer?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  /** Model name from the Custom LLM request when provided. */
  model?: string | null;
}

type ToolLike = {
  type?: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

/** Normalize Vapi/OpenAI tool advertisements into a flat list. */
export function extractAdvertisedTools(tools: unknown): ChannelTool[] {
  if (!Array.isArray(tools)) return [];
  const out: ChannelTool[] = [];
  const seen = new Set<string>();

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') continue;
    const t = tool as ToolLike;
    const fn = t.function && typeof t.function === 'object' ? t.function : null;
    const name =
      (fn && typeof fn.name === 'string' ? fn.name.trim() : '') ||
      (typeof t.name === 'string' ? t.name.trim() : '') ||
      (typeof t.type === 'string' &&
      ['endCall', 'transferCall', 'handoff'].includes(t.type)
        ? t.type
        : '');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      description:
        (fn && typeof fn.description === 'string' ? fn.description : undefined) ??
        (typeof t.description === 'string' ? t.description : undefined),
      parameters:
        (fn && fn.parameters && typeof fn.parameters === 'object'
          ? fn.parameters
          : undefined) ??
        (t.parameters && typeof t.parameters === 'object'
          ? t.parameters
          : undefined),
      type: typeof t.type === 'string' ? t.type : undefined,
    });
  }
  return out;
}

export function channelToolsApiFromList(tools: ChannelTool[]): ChannelToolsApi {
  const byName = new Map(tools.map((t) => [t.name, t]));
  return {
    list: () => [...tools],
    has: (name) => byName.has(name.trim()),
    get: (name) => byName.get(name.trim()),
  };
}

type ChatMessage = {
  role?: string;
  content?: unknown;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
};

function contentToString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'object' && part && 'text' in part
          ? String((part as { text: string }).text)
          : '',
      )
      .join(' ')
      .trim();
  }
  if (content == null) return '';
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function tryParseJson(text: string): unknown {
  const t = text.trim();
  if (!t) return undefined;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Collect `role:tool` messages from the newest Custom LLM request,
 * pairing names from prior assistant `tool_calls` when possible.
 */
export function extractToolResults(body: {
  messages?: ChatMessage[];
}): ChannelToolResult[] {
  const messages = body.messages ?? [];
  const nameByCallId = new Map<string, string>();

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !Array.isArray(msg.tool_calls)) continue;
    for (const tc of msg.tool_calls) {
      const id = typeof tc.id === 'string' ? tc.id : '';
      const name =
        tc.function && typeof tc.function.name === 'string'
          ? tc.function.name
          : '';
      if (id && name) nameByCallId.set(id, name);
    }
  }

  const results: ChannelToolResult[] = [];
  for (const msg of messages) {
    if (msg.role !== 'tool') continue;
    const content = contentToString(msg.content);
    const toolCallId =
      typeof msg.tool_call_id === 'string' ? msg.tool_call_id : undefined;
    const name =
      (typeof msg.name === 'string' && msg.name) ||
      (toolCallId ? nameByCallId.get(toolCallId) : undefined);
    results.push({
      toolCallId,
      name,
      content,
      parsed: tryParseJson(content),
    });
  }
  return results;
}

/** Metadata keys stashed on SupervisedConversation.metadata each Custom LLM turn. */
export const CHANNEL_META = {
  tools: 'channelTools',
  toolResults: 'lastToolResults',
  vapi: 'vapi',
  pendingToolNodeId: 'pendingToolCallNodeId',
} as const;
