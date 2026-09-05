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
exports.ClaudeBrainAdapter = void 0;
const common_1 = require("@nestjs/common");
const event_service_1 = require("../../events/event.service");
const brain_usage_tracker_1 = require("../brain-usage.tracker");
const brain_config_1 = require("../brain-config");
const claude_cheap_models_1 = require("../claude-cheap-models");
const json_llm_brain_base_1 = require("./json-llm-brain.base");
/**
 * Vapi Studio Claude Brain — Anthropic Messages API on a **cheap Haiku whitelist**.
 *
 * Env: `ANTHROPIC_API_KEY`. Same scan/clarify/judge contracts as ChatGPT (3s timeout).
 */
let ClaudeBrainAdapter = class ClaudeBrainAdapter extends json_llm_brain_base_1.JsonLlmBrainAdapter {
    adapterId = 'studio-claude';
    logger = new common_1.Logger('ClaudeBrainAdapter');
    constructor(usage, events, brainConfig) {
        super(usage, events, brainConfig);
    }
    requireApiKey(op) {
        const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
        if (!apiKey || apiKey.startsWith('sk-mock') || apiKey === 'REPLACE_ME') {
            throw new Error(`ClaudeBrainAdapter.${op} requires a real ANTHROPIC_API_KEY (not mock). ` +
                `Keep the app on MockBrainAdapter in code until Claude is enabled.`);
        }
        return apiKey;
    }
    resolveModel(override) {
        return (0, claude_cheap_models_1.resolveCheapClaudeModel)(override || this.brainConfig?.model);
    }
    async completeJson(input) {
        const started = Date.now();
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': input.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            signal: AbortSignal.timeout(json_llm_brain_base_1.JSON_LLM_BRAIN_TIMEOUT_MS),
            body: JSON.stringify({
                model: input.model.id,
                max_tokens: 1024,
                temperature: 0,
                system: input.system,
                messages: [{ role: 'user', content: input.user }],
            }),
        });
        if (!res.ok) {
            const body = await res.text();
            this.logger.error(`Anthropic brain ${input.kind} failed: ${res.status} ${body}`);
            throw new Error(`ClaudeBrainAdapter ${input.kind} error: ${res.status}`);
        }
        const json = (await res.json());
        const textParts = (json.content ?? [])
            .filter((p) => p.type === 'text' && typeof p.text === 'string')
            .map((p) => p.text);
        const content = textParts.join('\n').trim() || '{}';
        const usage = {
            prompt_tokens: json.usage?.input_tokens ?? 0,
            completion_tokens: json.usage?.output_tokens ?? 0,
            total_tokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
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
exports.ClaudeBrainAdapter = ClaudeBrainAdapter;
exports.ClaudeBrainAdapter = ClaudeBrainAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(brain_config_1.STUDIO_BRAIN_CONFIG)),
    __metadata("design:paramtypes", [brain_usage_tracker_1.BrainUsageTracker,
        event_service_1.EventService, Object])
], ClaudeBrainAdapter);
//# sourceMappingURL=claude-brain.adapter.js.map