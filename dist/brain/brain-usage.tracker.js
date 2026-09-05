"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainUsageTracker = void 0;
const common_1 = require("@nestjs/common");
const llm_model_pricing_1 = require("./llm-model-pricing");
/**
 * Per-call LLM usage ledger for stock Brain adapters (ChatGPT / Claude / Gemini / Grok).
 * Printed as $$$ at end of call (finalize).
 */
let BrainUsageTracker = class BrainUsageTracker {
    byCall = new Map();
    beginCall(providerCallId, conversationId) {
        if (!providerCallId)
            return;
        const existing = this.byCall.get(providerCallId);
        if (existing) {
            if (conversationId)
                existing.conversationId = conversationId;
            return;
        }
        this.byCall.set(providerCallId, {
            providerCallId,
            conversationId,
            records: [],
        });
    }
    record(input) {
        this.beginCall(input.providerCallId, input.conversationId);
        const bucket = this.byCall.get(input.providerCallId);
        const promptTokens = Math.max(0, Math.floor(input.promptTokens || 0));
        const completionTokens = Math.max(0, Math.floor(input.completionTokens || 0));
        const record = {
            kind: input.kind,
            model: input.model,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimatedUsd: (0, llm_model_pricing_1.estimateUsdCost)({
                model: input.model,
                promptTokens,
                completionTokens,
            }),
            at: new Date().toISOString(),
        };
        bucket.records.push(record);
        return record;
    }
    summary(providerCallId) {
        const bucket = this.byCall.get(providerCallId);
        if (!bucket)
            return null;
        const byModel = {};
        let promptTokens = 0;
        let completionTokens = 0;
        let estimatedUsd = 0;
        for (const r of bucket.records) {
            promptTokens += r.promptTokens;
            completionTokens += r.completionTokens;
            estimatedUsd += r.estimatedUsd;
            const row = byModel[r.model] ?? {
                calls: 0,
                promptTokens: 0,
                completionTokens: 0,
                estimatedUsd: 0,
            };
            row.calls += 1;
            row.promptTokens += r.promptTokens;
            row.completionTokens += r.completionTokens;
            row.estimatedUsd += r.estimatedUsd;
            byModel[r.model] = row;
        }
        return {
            providerCallId,
            conversationId: bucket.conversationId,
            calls: bucket.records.length,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimatedUsd,
            byModel,
            records: [...bucket.records],
        };
    }
    /** Format a short money line for console / logs. */
    formatMoney(usd) {
        if (usd <= 0)
            return '$0.000000';
        if (usd < 0.01)
            return `$${usd.toFixed(6)}`;
        return `$${usd.toFixed(4)}`;
    }
    clear(providerCallId) {
        this.byCall.delete(providerCallId);
    }
};
exports.BrainUsageTracker = BrainUsageTracker;
exports.BrainUsageTracker = BrainUsageTracker = __decorate([
    (0, common_1.Injectable)()
], BrainUsageTracker);
//# sourceMappingURL=brain-usage.tracker.js.map