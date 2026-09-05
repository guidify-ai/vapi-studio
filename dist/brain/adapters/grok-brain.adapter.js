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
exports.GrokBrainAdapter = void 0;
const common_1 = require("@nestjs/common");
const event_service_1 = require("../../events/event.service");
const brain_usage_tracker_1 = require("../brain-usage.tracker");
const brain_config_1 = require("../brain-config");
const grok_cheap_models_1 = require("../grok-cheap-models");
const json_llm_brain_base_1 = require("./json-llm-brain.base");
/**
 * Vapi Studio Grok Brain — xAI OpenAI-compatible Chat Completions on a **cheap whitelist**.
 *
 * Env: `XAI_API_KEY`. Same scan/clarify/judge contracts as ChatGPT (3s timeout).
 */
let GrokBrainAdapter = class GrokBrainAdapter extends json_llm_brain_base_1.JsonLlmBrainAdapter {
    adapterId = 'studio-grok';
    logger = new common_1.Logger('GrokBrainAdapter');
    constructor(usage, events, brainConfig) {
        super(usage, events, brainConfig);
    }
    requireApiKey(op) {
        const apiKey = process.env.XAI_API_KEY?.trim();
        if (!apiKey || apiKey.startsWith('sk-mock') || apiKey === 'REPLACE_ME') {
            throw new Error(`GrokBrainAdapter.${op} requires a real XAI_API_KEY (not mock). ` +
                `Keep the app on MockBrainAdapter in code until Grok is enabled.`);
        }
        return apiKey;
    }
    resolveModel(override) {
        return (0, grok_cheap_models_1.resolveCheapGrokModel)(override || this.brainConfig?.model);
    }
    async completeJson(input) {
        const started = Date.now();
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
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
            this.logger.error(`xAI brain ${input.kind} failed: ${res.status} ${body}`);
            throw new Error(`GrokBrainAdapter ${input.kind} error: ${res.status}`);
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
exports.GrokBrainAdapter = GrokBrainAdapter;
exports.GrokBrainAdapter = GrokBrainAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(brain_config_1.STUDIO_BRAIN_CONFIG)),
    __metadata("design:paramtypes", [brain_usage_tracker_1.BrainUsageTracker,
        event_service_1.EventService, Object])
], GrokBrainAdapter);
//# sourceMappingURL=grok-brain.adapter.js.map