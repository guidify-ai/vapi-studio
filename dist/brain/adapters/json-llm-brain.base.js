"use strict";
/**
 * Shared JSON-LLM Brain orchestration (scan / clarify / judge).
 * Provider adapters only implement auth, model whitelist, and completeJson().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonLlmBrainAdapter = exports.JSON_LLM_BRAIN_TIMEOUT_MS = void 0;
exports.detectUserSpeechSeries = detectUserSpeechSeries;
exports.safeJsonParse = safeJsonParse;
const standard_intentions_1 = require("../../intentions/standard-intentions");
const brain_clarify_1 = require("../brain-clarify");
const brain_judge_1 = require("../brain-judge");
const brain_ranking_1 = require("../brain-ranking");
const prompt_injection_guard_1 = require("../prompt-injection-guard");
/** Fail the provider round-trip rather than stalling a live call. */
exports.JSON_LLM_BRAIN_TIMEOUT_MS = 3_000;
/** Keep scan prompts small — live voice cannot wait on a fat history dump. */
const SCAN_HISTORY_CHAT = 8;
const SCAN_HISTORY_NODES = 8;
/**
 * Template for stock Brain adapters that call a JSON-capable LLM.
 * Subclasses supply API key, model whitelist, and the HTTP completion call.
 */
class JsonLlmBrainAdapter {
    usage;
    events;
    brainConfig;
    constructor(usage, events, brainConfig) {
        this.usage = usage;
        this.events = events;
        this.brainConfig = brainConfig;
    }
    async scan(input) {
        const apiKey = this.requireApiKey('scan');
        const model = this.resolveModel();
        const listen = input.listen ?? input.runtime.listenExpectation;
        const threshold = (0, brain_ranking_1.resolveConfidenceThreshold)(input.confidenceThreshold);
        const candidates = this.resolveCandidates(input);
        const extractFields = listen?.extract?.fields ?? [];
        const series = detectUserSpeechSeries(input.userText);
        this.usage.beginCall(input.runtime.providerCallId, input.runtime.conversationId);
        this.events.log('info', 'BRAIN_SCAN_START', {
            adapter: this.adapterId,
            providerCallId: input.runtime.providerCallId,
            conversationId: input.runtime.conversationId,
            model: model.id,
            turnNumber: input.runtime.turn.turnNumber,
            userText: input.userText,
            series: series.isSeries,
            seriesParts: series.parts,
            candidateCount: candidates.length,
            extractKeys: extractFields.map((f) => f.key),
            threshold,
        });
        if ((0, prompt_injection_guard_1.utteranceLooksLikePromptInjection)(input.userText, series.isSeries ? series.parts : undefined)) {
            this.events.log('warn', 'BRAIN_SCAN_RESULT', {
                adapter: this.adapterId,
                providerCallId: input.runtime.providerCallId,
                model: model.id,
                winner: standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition,
                reason: 'prompt_injection_blocked',
            });
            return {
                intentions: [
                    this.unknownIntention(input, 'prompt_injection_blocked', threshold),
                ],
            };
        }
        if (!candidates.length) {
            const empty = {
                intentions: [this.unknownIntention(input, 'no_candidates', threshold)],
            };
            this.events.log('info', 'BRAIN_SCAN_RESULT', {
                adapter: this.adapterId,
                providerCallId: input.runtime.providerCallId,
                winner: standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition,
                reason: 'no_candidates',
            });
            return empty;
        }
        const system = buildScanSystemPrompt({
            candidates,
            extractFields,
            hints: listen?.hints,
            threshold,
            series,
        });
        const history = input.history ?? {
            chat: input.runtime.history.chat,
            nodes: input.runtime.history.nodes,
        };
        const user = JSON.stringify({
            ...(0, prompt_injection_guard_1.wrapUntrustedUserText)(input.userText),
            userSpeechSeries: series.isSeries ? series.parts : undefined,
            turnNumber: input.runtime.turn.turnNumber,
            currentNodeId: input.runtime.currentNodeId,
            normalFlowNodeId: input.runtime.normalFlowNodeId,
            activePortalId: input.runtime.portalState.activePortalId,
            history: {
                chat: history.chat.slice(-SCAN_HISTORY_CHAT),
                nodes: history.nodes.slice(-SCAN_HISTORY_NODES),
            },
            listenIntentions: listen?.intentions?.map((i) => ({
                name: i.name,
                boost: i.boost ?? 0,
                priority: i.priority ?? 1,
            })),
        });
        const scanStarted = Date.now();
        let content;
        let usage;
        try {
            const completion = await this.completeJson({
                apiKey,
                model,
                kind: 'scan',
                providerCallId: input.runtime.providerCallId,
                conversationId: input.runtime.conversationId,
                system,
                user,
            });
            content = completion.content;
            usage = completion.usage;
        }
        catch (error) {
            const durationMs = Date.now() - scanStarted;
            this.events.log('warn', 'BRAIN_SCAN_RESULT', {
                adapter: this.adapterId,
                providerCallId: input.runtime.providerCallId,
                model: model.id,
                winner: standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition,
                reason: 'scan_error',
                durationMs,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                intentions: [
                    this.unknownIntention(input, 'scan_error', threshold, {
                        durationMs,
                    }),
                ],
            };
        }
        const durationMs = Date.now() - scanStarted;
        const parsed = safeJsonParse(content);
        const allowed = new Set(candidates.map((c) => c.name));
        const scores = (parsed.intentions ?? [])
            .filter((i) => typeof i.name === 'string' &&
            allowed.has(i.name.trim()) &&
            typeof i.confidence === 'number')
            .map((i) => ({
            name: String(i.name).trim(),
            confidence: Number(i.confidence),
            reason: i.reason,
        }));
        const extracted = this.filterExtracted(parsed.extracted, extractFields);
        if ((0, brain_ranking_1.allBelowConfidenceThreshold)(scores, threshold)) {
            this.events.log('info', 'BRAIN_SCAN_RESULT', {
                adapter: this.adapterId,
                providerCallId: input.runtime.providerCallId,
                model: model.id,
                winner: standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition,
                reason: 'below_confidence_threshold',
                threshold,
                scores,
                extracted,
                usage,
                durationMs,
            });
            return {
                intentions: [
                    this.unknownIntention(input, 'below_confidence_threshold', threshold, {
                        scores,
                        series: series.isSeries,
                    }),
                ],
                extracted,
            };
        }
        const ranked = (0, brain_ranking_1.scoresToRankedCandidates)(scores, candidates, {
            userText: input.userText,
            hints: listen?.hints,
            adapter: this.adapterId,
            threshold,
            series: series.isSeries,
        });
        this.events.log('info', 'BRAIN_SCAN_RESULT', {
            adapter: this.adapterId,
            providerCallId: input.runtime.providerCallId,
            model: model.id,
            winner: ranked[0]?.name,
            scores,
            extracted,
            usage,
            durationMs,
        });
        return {
            intentions: ranked,
            extracted,
        };
    }
    async clarify(request) {
        const apiKey = this.requireApiKey('clarify');
        const model = this.resolveModel();
        const inputText = (0, brain_clarify_1.clarifiableInputToString)(request.input);
        const series = detectUserSpeechSeries(inputText);
        this.events.log('info', 'BRAIN_CLARIFY_START', {
            adapter: this.adapterId,
            providerCallId: request.meta?.providerCallId,
            conversationId: request.meta?.conversationId,
            model: model.id,
            question: request.question,
            input: inputText,
            series: series.isSeries,
            fields: (request.answer.fields ?? []).map((f) => f.key),
        });
        if ((0, prompt_injection_guard_1.utteranceLooksLikePromptInjection)(inputText, series.isSeries ? series.parts : undefined)) {
            this.events.log('warn', 'BRAIN_CLARIFY_RESULT', {
                adapter: this.adapterId,
                providerCallId: request.meta?.providerCallId,
                model: model.id,
                question: request.question,
                reason: 'prompt_injection_blocked',
            });
            (0, brain_clarify_1.throwClarifyCannotAnswer)('prompt_injection_blocked');
        }
        const system = [
            ...(0, prompt_injection_guard_1.brainUntrustedInputRules)('clarify'),
            'You are the Vapi Studio Brain clarifier for a voice bot.',
            'Answer the question about the provided input.',
            'Return ONLY valid JSON in ONE of these forms:',
            '1) {"answer":{...}}',
            `2) {"outcome":"${brain_clarify_1.STUDIO_CLARIFY_CANNOT_ANSWER}","reason":"<short>"}`,
            `Use ${brain_clarify_1.STUDIO_CLARIFY_CANNOT_ANSWER} when the input is insufficient, contradictory, or you cannot reliably fill required fields.`,
            'ASR NOISE: input is often speech-to-text. Filter fillers ("um", "uh", "erm", "hmm", "like", "you know"), stutters, false starts, and unrelated asides / crosstalk when the actionable answer is still clear.',
            'Strip that noise from extracted field values; do not invent content from noise alone.',
            'When answered, the answer object MUST use exactly these fields (omit unknown optional keys):',
            JSON.stringify((request.answer.fields ?? []).map((f) => ({
                key: f.key,
                type: f.type ?? 'string',
                required: f.required ?? false,
                description: f.description,
            }))),
            request.answer.description
                ? `Answer object description: ${request.answer.description}`
                : '',
            series.isSeries
                ? 'Input may list several rapid user utterances — treat them as one answer (after noise filtering), prefer the most specific / latest clear value.'
                : '',
        ]
            .filter(Boolean)
            .join('\n');
        const user = JSON.stringify({
            question: request.question,
            ...(0, prompt_injection_guard_1.wrapUntrustedUserText)(inputText),
            userSpeechSeries: series.isSeries ? series.parts : undefined,
        });
        const providerCallId = request.meta?.providerCallId?.trim() || 'clarify-orphan';
        if (request.meta?.providerCallId) {
            this.usage.beginCall(request.meta.providerCallId, request.meta.conversationId);
        }
        const { content, usage } = await this.completeJson({
            apiKey,
            model,
            kind: 'clarify',
            providerCallId,
            conversationId: request.meta?.conversationId,
            system,
            user,
        });
        const parsed = safeJsonParse(content);
        const result = (0, brain_clarify_1.normalizeClarifyResult)(parsed, request.answer);
        this.events.log('info', 'BRAIN_CLARIFY_RESULT', {
            adapter: this.adapterId,
            providerCallId: request.meta?.providerCallId,
            model: model.id,
            question: request.question,
            answer: result.answer,
            usage,
        });
        return result;
    }
    async judge(request) {
        const apiKey = this.requireApiKey('judge');
        const model = this.resolveModel(request.options?.model);
        const contextText = (0, brain_judge_1.judgeContextToString)(request.context);
        const threshold = (0, brain_judge_1.resolveJudgeConfidenceThreshold)(request.options?.confidenceThreshold);
        this.events.log('info', 'BRAIN_JUDGE_START', {
            adapter: this.adapterId,
            providerCallId: request.meta?.providerCallId,
            conversationId: request.meta?.conversationId,
            model: model.id,
            goals: request.goals,
            successConditions: request.successConditions,
            failureConditions: request.failureConditions,
            threshold,
        });
        const system = [
            ...(0, prompt_injection_guard_1.brainUntrustedInputRules)('judge'),
            'You are an LLM-as-a-judge for Vapi Studio conversation evals.',
            'Read the context. Understand the goal in plain language.',
            'A PASS requires: the goal is met, EVERY success condition holds, and NO failure condition is triggered.',
            'A FAIL if any failure condition is present, any success condition is missing, or the goal is not met.',
            'Return ONLY valid JSON:',
            '{"passed":true,"confidence":0.0,"reasoning":["<short reason>","<short reason>"]}',
            'confidence is 0..1 (1 = certain). reasoning is a list of short strings explaining WHY you passed or failed.',
            'Do not invent facts that are not in the context. Prefer fail when evidence is missing.',
            `Runtime confidence threshold is ${threshold} (informational; still return your raw passed + confidence).`,
        ].join('\n');
        const user = JSON.stringify({
            context: contextText,
            goals: request.goals,
            successConditions: request.successConditions ?? [],
            failureConditions: request.failureConditions ?? [],
        });
        const providerCallId = request.meta?.providerCallId?.trim() || 'judge-orphan';
        if (request.meta?.providerCallId) {
            this.usage.beginCall(request.meta.providerCallId, request.meta.conversationId);
        }
        const { content, usage } = await this.completeJson({
            apiKey,
            model,
            kind: 'judge',
            providerCallId,
            conversationId: request.meta?.conversationId,
            system,
            user,
        });
        const parsed = safeJsonParse(content);
        const result = (0, brain_judge_1.normalizeJudgeResult)(parsed, request.options);
        this.events.log('info', 'BRAIN_JUDGE_RESULT', {
            adapter: this.adapterId,
            providerCallId: request.meta?.providerCallId,
            model: model.id,
            passed: result.passed,
            confidence: result.confidence,
            belowThreshold: result.belowThreshold,
            reasoning: result.reasoning,
            usage,
        });
        return result;
    }
    /** Record usage after a successful provider call (shared by adapters). */
    recordUsage(input) {
        const record = this.usage.record({
            providerCallId: input.providerCallId,
            conversationId: input.conversationId,
            kind: input.kind,
            model: input.model.id,
            promptTokens: input.usage.prompt_tokens ?? 0,
            completionTokens: input.usage.completion_tokens ?? 0,
        });
        this.events.log('info', 'BRAIN_USAGE', {
            adapter: this.adapterId,
            providerCallId: input.providerCallId,
            kind: input.kind,
            model: input.model.id,
            promptTokens: record.promptTokens,
            completionTokens: record.completionTokens,
            estimatedUsd: record.estimatedUsd,
            money: this.usage.formatMoney(record.estimatedUsd),
            durationMs: Date.now() - input.started,
        });
    }
    filterExtracted(raw, fields) {
        if (!fields.length || !raw || typeof raw !== 'object') {
            return undefined;
        }
        const allowed = new Set(fields.map((f) => f.key));
        const out = {};
        for (const [key, value] of Object.entries(raw)) {
            if (!allowed.has(key))
                continue;
            if (value === undefined || value === null || value === '')
                continue;
            if (typeof value === 'string') {
                const sanitized = (0, prompt_injection_guard_1.sanitizeExtractedFieldValue)(value);
                if (sanitized === undefined)
                    continue;
                out[key] = sanitized;
                continue;
            }
            out[key] = value;
        }
        return Object.keys(out).length ? out : undefined;
    }
    resolveCandidates(input) {
        if (input.candidates?.length) {
            return input.candidates;
        }
        const listen = input.listen ?? input.runtime.listenExpectation;
        return (listen?.intentions ?? []).map((i) => ({
            name: i.name,
            boost: i.boost,
            priority: i.priority,
            source: 'listen',
        }));
    }
    unknownIntention(input, reason, threshold, extra = {}) {
        const confidence = (0, brain_ranking_1.roundConfidence)(0);
        return {
            name: standard_intentions_1.STANDARD_INTENTIONS.isUnknownTransition,
            confidence,
            priority: 0,
            rank: 1_000_000,
            payload: {
                userText: input.userText,
                reason,
                threshold,
                adapter: this.adapterId,
                hints: input.listen?.hints ?? input.runtime.listenExpectation?.hints,
                ...extra,
            },
        };
    }
}
exports.JsonLlmBrainAdapter = JsonLlmBrainAdapter;
function buildScanSystemPrompt(input) {
    return [
        ...(0, prompt_injection_guard_1.brainUntrustedInputRules)('scan'),
        'You are the Vapi Studio Brain for a voice bot: score intentions and extract fields.',
        'Score ONLY the provided candidate intentions for the latest user utterance.',
        'Use compact history for context; the latest untrustedCallerText is the turn to score.',
        'Return ONLY valid JSON of the form:',
        '{"intentions":[{"name":"<exact candidate name>","confidence":0.123456,"reason":"<short>"}],"extracted":{"<key>":"<value>"}}',
        'confidence is 0..1 inclusive with 6 decimal places. NEVER return a value above 1.',
        'Include every candidate you can score. Boost is a hint, not a score.',
        `studio.isUnknownTransition is the scan-failure intent — score it high only when none of the other candidates fit.`,
        `Runtime confidence threshold is ${input.threshold} (informational).`,
        'ASR NOISE: untrustedCallerText is speech-to-text and often messy. Mentally filter fillers and dead air such as "um", "uh", "erm", "hmm", "like", "you know", stutters, false starts, and trailing fragments that are not part of the answer.',
        'Also ignore clearly unrelated asides / self-talk / crosstalk when the actionable meaning is still clear (e.g. "uh yeah tomorrow — sorry dog — morning" → tomorrow morning).',
        'Do not invent meaning from noise alone; if after filtering nothing substantive remains, give low confidence.',
        input.series.isSeries
            ? [
                'IMPORTANT: untrustedCallerText may be a SERIES of rapid / overlapping utterances (barge-in queue).',
                'Treat the numbered list as one combined user answer, not separate turns.',
                'Prefer the most specific, latest clear meaning across the series (after noise filtering).',
                `Series parts: ${JSON.stringify(input.series.parts)}`,
            ].join(' ')
            : '',
        input.extractFields.length
            ? `Extract these fields into "extracted" (omit key if truly unknown; strip fillers from values): ${JSON.stringify(input.extractFields.map((f) => ({
                key: f.key,
                description: f.description,
                type: f.type ?? 'string',
                required: f.required ?? false,
            })))}`
            : 'No extract fields — return "extracted": {}.',
        `Candidates: ${JSON.stringify(input.candidates.map((c) => ({
            name: c.name,
            boost: c.boost ?? 0,
            priority: c.priority ?? 1,
            source: c.source ?? 'flow',
        })))}`,
        input.hints?.length
            ? `ASR/ops hints (transcript may be messy): ${input.hints.join(' | ')}`
            : '',
    ]
        .filter(Boolean)
        .join('\n');
}
/** Detect CallTurnQueue coalesced multi-utterance user text. */
function detectUserSpeechSeries(userText) {
    const text = userText.trim();
    if (!text)
        return { isSeries: false, parts: [] };
    if (!/several times in quick succession/i.test(text)) {
        return { isSeries: false, parts: [text] };
    }
    const parts = [];
    const re = /^\s*\d+\)\s*(.+)$/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
        const part = m[1].trim();
        if (part)
            parts.push(part);
    }
    return {
        isSeries: parts.length > 1,
        parts: parts.length ? parts : [text],
    };
}
function safeJsonParse(content) {
    try {
        return JSON.parse(content);
    }
    catch {
        // Providers sometimes wrap JSON in markdown fences.
        const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1]) {
            try {
                return JSON.parse(fenced[1].trim());
            }
            catch {
                return {};
            }
        }
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(content.slice(start, end + 1));
            }
            catch {
                return {};
            }
        }
        return {};
    }
}
//# sourceMappingURL=json-llm-brain.base.js.map