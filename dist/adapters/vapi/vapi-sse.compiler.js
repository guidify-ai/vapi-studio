"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VapiSseCompiler = void 0;
exports.extractToolFunctionNames = extractToolFunctionNames;
exports.resolveEndCallToolName = resolveEndCallToolName;
exports.resolveTransferCallToolName = resolveTransferCallToolName;
exports.resolveHandoffToolName = resolveHandoffToolName;
exports.buildVapiHandoffToolArgs = buildVapiHandoffToolArgs;
exports.hasAdvertisedHandoffTool = hasAdvertisedHandoffTool;
exports.extractNewestUserText = extractNewestUserText;
exports.extractVapiCallId = extractVapiCallId;
exports.extractVapiCallerNumber = extractVapiCallerNumber;
function sseData(payload) {
    return `data: ${JSON.stringify(payload)}\n\n`;
}
function extractToolFunctionNames(tools) {
    if (!Array.isArray(tools)) {
        return [];
    }
    const names = [];
    for (const tool of tools) {
        if (!tool || typeof tool !== 'object') {
            continue;
        }
        const t = tool;
        const fnObj = typeof t.function === 'object' && t.function
            ? t.function
            : null;
        const fnName = (fnObj && typeof fnObj.name === 'string' ? fnObj.name : null) ??
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
function resolveEndCallToolName(tools) {
    const advertised = extractToolFunctionNames(tools ?? []);
    const configured = process.env.VAPI_END_CALL_TOOL_NAME?.trim() || 'end_call_tool';
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
function resolveTransferCallToolName(tools) {
    const advertised = extractToolFunctionNames(tools ?? []);
    const configured = process.env.VAPI_TRANSFER_CALL_TOOL_NAME?.trim() || 'transferCall';
    if (advertised.includes(configured)) {
        return configured;
    }
    if (advertised.includes('transferCall')) {
        return 'transferCall';
    }
    const fuzzy = advertised.find((n) => /transfer/i.test(n));
    return fuzzy ?? configured;
}
function resolveHandoffToolName(tools, assistantName) {
    const configured = process.env.VAPI_HANDOFF_TOOL_NAME?.trim() || 'handoff';
    const needle = assistantName?.trim();
    // Prefer a destination-specific tool (OpenAI multi-tool / handoff_to_<name> pattern).
    if (needle) {
        const matched = findHandoffToolNameForDestination(tools, needle);
        if (matched)
            return matched;
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
function buildVapiHandoffToolArgs(input) {
    const destination = input.assistantName.trim();
    const args = { destination };
    if (input.reason?.trim()) {
        args.reason = input.reason.trim();
    }
    if (input.payload && Object.keys(input.payload).length > 0) {
        // Extra keys map to tool.function.parameters for variable extraction.
        for (const [key, value] of Object.entries(input.payload)) {
            if (key === 'destination')
                continue;
            args[key] = value;
        }
    }
    return args;
}
/** True when the Custom LLM request advertises at least one handoff tool. */
function hasAdvertisedHandoffTool(tools) {
    return extractToolFunctionNames(tools ?? []).some((n) => /handoff/i.test(n));
}
function findHandoffToolNameForDestination(tools, assistantName) {
    if (!Array.isArray(tools))
        return null;
    const needle = assistantName.trim().toLowerCase();
    const slug = needle.replace(/[^a-z0-9]+/g, '_');
    for (const tool of tools) {
        if (!tool || typeof tool !== 'object')
            continue;
        const t = tool;
        const fn = typeof t.function === 'object' && t.function
            ? t.function
            : null;
        const fnName = (fn && typeof fn.name === 'string' ? fn.name : null) ??
            (typeof t.name === 'string' ? t.name : null);
        const destinations = Array.isArray(t.destinations) ? t.destinations : [];
        for (const dest of destinations) {
            if (!dest || typeof dest !== 'object')
                continue;
            const d = dest;
            const name = (typeof d.assistantName === 'string' && d.assistantName) ||
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
        const params = fn && typeof fn.parameters === 'object' && fn.parameters
            ? fn.parameters
            : null;
        const props = params && typeof params.properties === 'object' && params.properties
            ? params.properties
            : null;
        const destProp = props && typeof props.destination === 'object' && props.destination
            ? props.destination
            : null;
        const enumVals = Array.isArray(destProp?.enum) ? destProp.enum : [];
        if (enumVals.some((v) => typeof v === 'string' && v.trim().toLowerCase() === needle) &&
            fnName) {
            return fnName;
        }
        if (fnName &&
            /handoff/i.test(fnName) &&
            (fnName.toLowerCase().includes(slug) ||
                fnName.toLowerCase().includes(needle.replace(/\s+/g, '')))) {
            return fnName;
        }
    }
    return null;
}
/**
 * Compiles Vapi Studio output actions into OpenAI-compatible SSE for Vapi Custom LLM.
 */
class VapiSseCompiler {
    model;
    id;
    tools;
    constructor(opts) {
        this.model = opts?.model ?? 'vapi-studio';
        this.id = opts?.id ?? `chatcmpl-${Date.now()}`;
        this.tools = opts?.tools;
    }
    /** Replay prior assistant utterances onto this SSE (coalesced waiter). */
    replayAssistantSpeech(writer, texts) {
        const spoken = texts.map((t) => t.trim()).filter(Boolean);
        if (spoken.length === 0) {
            this.writeAssistantText(writer, '');
            return;
        }
        for (const text of spoken) {
            this.writeAssistantText(writer, text);
        }
    }
    writeAssistantText(writer, text) {
        writer.write(sseData({
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
        }));
    }
    writeToolCall(writer, name, args, index = 0) {
        const callId = `call_${name}_${Date.now()}_${index}`;
        // OpenAI-style streaming: announce tool call, then finalize with tool_calls.
        writer.write(sseData({
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
        }));
        writer.write(sseData({
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
        }));
        writer.write(sseData({
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
        }));
    }
    /** Close stream after normal speech (no tool call). */
    finish(writer) {
        writer.write(sseData({
            id: this.id,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: this.model,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        }));
        writer.write('data: [DONE]\n\n');
        writer.end();
    }
    /** Close stream after a tool call — do not emit finish_reason=stop. */
    finishAfterToolCalls(writer) {
        writer.write('data: [DONE]\n\n');
        writer.end();
    }
    async streamTerminalActions(writer, actions) {
        let toolIndex = 0;
        const emittedTools = [];
        for (const action of actions) {
            if (action.kind === 'endCall') {
                const name = resolveEndCallToolName(this.tools);
                this.writeToolCall(writer, name, {}, toolIndex++);
                emittedTools.push(name);
            }
            if (action.kind === 'transferToHuman') {
                const name = resolveTransferCallToolName(this.tools);
                this.writeToolCall(writer, name, {
                    destination: action.destination ?? process.env.VAPI_TRANSFER_DESTINATION,
                }, toolIndex++);
                emittedTools.push(name);
            }
            if (action.kind === 'handoff') {
                const assistantName = action.assistantName?.trim() ||
                    action.handoffTo?.trim() ||
                    '';
                const name = resolveHandoffToolName(this.tools, assistantName);
                this.writeToolCall(writer, name, buildVapiHandoffToolArgs({
                    assistantName,
                    reason: action.handoffReason,
                    payload: action.handoffPayload,
                }), toolIndex++);
                emittedTools.push(name);
            }
            if (action.kind === 'toolCall' && action.toolCall?.name) {
                const name = action.toolCall.name.trim();
                this.writeToolCall(writer, name, action.toolCall.arguments ?? {}, toolIndex++);
                emittedTools.push(name);
            }
        }
        if (emittedTools.length > 0) {
            this.finishAfterToolCalls(writer);
        }
        else {
            this.finish(writer);
        }
        return { emittedTools };
    }
}
exports.VapiSseCompiler = VapiSseCompiler;
function extractNewestUserText(body) {
    const messages = body.messages ?? [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const msg = messages[i];
        if (msg.role === 'user') {
            if (typeof msg.content === 'string') {
                return msg.content;
            }
            if (Array.isArray(msg.content)) {
                return msg.content
                    .map((part) => typeof part === 'object' && part && 'text' in part
                    ? String(part.text)
                    : '')
                    .join(' ')
                    .trim();
            }
        }
    }
    return '';
}
function extractVapiCallId(body) {
    const candidates = [
        body.callId,
        body.call_id,
        body.call?.id,
        body.metadata?.callId,
        body.metadata?.call_id,
        (body.vapi?.call)?.id,
    ];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}
function extractVapiCallerNumber(body) {
    if (!body || typeof body !== 'object')
        return null;
    const message = body.message && typeof body.message === 'object'
        ? body.message
        : body;
    const call = (message.call ?? body.call);
    const customer = (call?.customer ??
        message.customer ??
        body.customer);
    const candidates = [
        customer?.number,
        customer?.phoneNumber,
        customer?.phone,
        call?.from,
        message.from,
        body.from,
    ];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}
//# sourceMappingURL=vapi-sse.compiler.js.map