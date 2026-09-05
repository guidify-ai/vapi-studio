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
exports.GeminiBrainAdapter = void 0;
const common_1 = require("@nestjs/common");
const event_service_1 = require("../../events/event.service");
const brain_usage_tracker_1 = require("../brain-usage.tracker");
const brain_config_1 = require("../brain-config");
const gemini_cheap_models_1 = require("../gemini-cheap-models");
const json_llm_brain_base_1 = require("./json-llm-brain.base");
/**
 * Vapi Studio Gemini Brain — Google Generative Language API on a **cheap Flash whitelist**.
 *
 * Env: `GOOGLE_API_KEY` (or `GEMINI_API_KEY`). Same scan/clarify/judge contracts (3s timeout).
 */
let GeminiBrainAdapter = class GeminiBrainAdapter extends json_llm_brain_base_1.JsonLlmBrainAdapter {
    adapterId = 'studio-gemini';
    logger = new common_1.Logger('GeminiBrainAdapter');
    constructor(usage, events, brainConfig) {
        super(usage, events, brainConfig);
    }
    requireApiKey(op) {
        const apiKey = process.env.GOOGLE_API_KEY?.trim() ||
            process.env.GEMINI_API_KEY?.trim();
        if (!apiKey || apiKey.startsWith('sk-mock') || apiKey === 'REPLACE_ME') {
            throw new Error(`GeminiBrainAdapter.${op} requires a real GOOGLE_API_KEY (or GEMINI_API_KEY). ` +
                `Keep the app on MockBrainAdapter in code until Gemini is enabled.`);
        }
        return apiKey;
    }
    resolveModel(override) {
        return (0, gemini_cheap_models_1.resolveCheapGeminiModel)(override || this.brainConfig?.model);
    }
    async completeJson(input) {
        const started = Date.now();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/` +
            `${encodeURIComponent(input.model.id)}:generateContent` +
            `?key=${encodeURIComponent(input.apiKey)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: AbortSignal.timeout(json_llm_brain_base_1.JSON_LLM_BRAIN_TIMEOUT_MS),
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: input.system }],
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: input.user }],
                    },
                ],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: 'application/json',
                },
            }),
        });
        if (!res.ok) {
            const body = await res.text();
            this.logger.error(`Gemini brain ${input.kind} failed: ${res.status} ${body}`);
            throw new Error(`GeminiBrainAdapter ${input.kind} error: ${res.status}`);
        }
        const json = (await res.json());
        const parts = json.candidates?.[0]?.content?.parts ?? [];
        const content = parts
            .map((p) => p.text)
            .filter((t) => typeof t === 'string' && t.length > 0)
            .join('\n')
            .trim() || '{}';
        const usage = {
            prompt_tokens: json.usageMetadata?.promptTokenCount ?? 0,
            completion_tokens: json.usageMetadata?.candidatesTokenCount ?? 0,
            total_tokens: json.usageMetadata?.totalTokenCount,
        };
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
exports.GeminiBrainAdapter = GeminiBrainAdapter;
exports.GeminiBrainAdapter = GeminiBrainAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(brain_config_1.STUDIO_BRAIN_CONFIG)),
    __metadata("design:paramtypes", [brain_usage_tracker_1.BrainUsageTracker,
        event_service_1.EventService, Object])
], GeminiBrainAdapter);
//# sourceMappingURL=gemini-brain.adapter.js.map