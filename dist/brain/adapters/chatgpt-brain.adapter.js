"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGptBrainAdapter = exports.detectUserSpeechSeries = void 0;
const common_1 = require("@nestjs/common");
const event_service_1 = require("../../events/event.service");
const brain_usage_tracker_1 = require("../brain-usage.tracker");
const brain_config_1 = require("../brain-config");
const openai_cheap_models_1 = require("../openai-cheap-models");
const json_llm_brain_base_1 = require("./json-llm-brain.base");
var json_llm_brain_base_2 = require("./json-llm-brain.base");
Object.defineProperty(exports, "detectUserSpeechSeries", { enumerable: true, get: function () { return json_llm_brain_base_2.detectUserSpeechSeries; } });
/**
 * Vapi Studio ChatGPT Brain adapter — OpenAI Chat Completions on a **cheap model whitelist**.
 *
 * Implements scan / clarify / judge via {@link JsonLlmBrainAdapter}.
 *
 * Env: OPENAI_API_KEY. Live voice: scan immediately, abort at 3s, first speech target <1.5s.
 */
let ChatGptBrainAdapter = class ChatGptBrainAdapter extends json_llm_brain_base_1.JsonLlmBrainAdapter {
    adapterId = 'studio-chatgpt';
    logger = new common_1.Logger('ChatGptBrainAdapter');
    constructor(usage, events, brainConfig) {
        super(usage, events, brainConfig);
    }
    requireApiKey(op) {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey || apiKey.startsWith('sk-mock')) {
            throw new Error(`ChatGptBrainAdapter.${op} requires a real OPENAI_API_KEY (not mock). ` +
                `Keep the app on MockBrainAdapter in code until ChatGPT is enabled.`);
        }
        return apiKey;
    }
    resolveModel(override) {
        return (0, openai_cheap_models_1.resolveCheapOpenAiModel)(override || this.brainConfig?.model);
    }
    async completeJson(input) {
        const started = Date.now();
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${input.apiKey}`,
                'content-type': 'application/json',
            },
            signal: AbortSignal.timeout(json_llm_brain_base_1.JSON_LLM_BRAIN_TIMEOUT_MS),
            body: JSON.stringify({
                model: input.model.id,
                temperature: 0,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: input.system },
                    { role: 'user', content: input.user },
                ],
            }),
        });
        if (!res.ok) {
            const body = await res.text();
            this.logger.error(`OpenAI brain ${input.kind} failed: ${res.status} ${body}`);
            throw new Error(`ChatGptBrainAdapter ${input.kind} error: ${res.status}`);
        }
        const json = (await res.json());
        const content = json.choices?.[0]?.message?.content ?? '{}';
        const usage = json.usage ?? {};
        this.recordUsage({
            providerCallId: input.providerCallId,
            conversationId: input.conversationId,
            kind: input.kind,
            model: input.model,
            usage,
            started,
        });
        return { content, usage };
    }
};
exports.ChatGptBrainAdapter = ChatGptBrainAdapter;
exports.ChatGptBrainAdapter = ChatGptBrainAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(brain_config_1.STUDIO_BRAIN_CONFIG)),
    __metadata("design:paramtypes", [brain_usage_tracker_1.BrainUsageTracker,
        event_service_1.EventService, Object])
], ChatGptBrainAdapter);
//# sourceMappingURL=chatgpt-brain.adapter.js.map