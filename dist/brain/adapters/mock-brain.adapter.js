"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockBrainService = exports.MockBrainAdapter = void 0;
const fs_1 = require("fs");
const common_1 = require("@nestjs/common");
const yaml_1 = require("yaml");
const listen_expectation_1 = require("../../conversation/listen-expectation");
const conversation_history_1 = require("../../conversation/conversation-history");
const brain_ranking_1 = require("../brain-ranking");
const brain_clarify_1 = require("../brain-clarify");
const brain_judge_1 = require("../brain-judge");
/**
 * Deterministic Brain adapter for PoC / tests.
 * No network, no ChatGPT — sequence-driven intentions + listen boosts/hints + mock extract.
 */
let MockBrainAdapter = class MockBrainAdapter {
    profiles = new Map();
    activeProfileId = 'state-machine';
    loadProfile(profileId, path) {
        const raw = (0, yaml_1.parse)((0, fs_1.readFileSync)(path, 'utf8'));
        if (!raw?.sequence?.length) {
            throw new Error(`Invalid brain profile at ${path}`);
        }
        this.setSequence(profileId, raw.sequence);
    }
    setSequence(profileId, sequence) {
        if (!sequence.length) {
            throw new Error(`Brain sequence empty for profile ${profileId}`);
        }
        this.profiles.set(profileId, sequence);
    }
    setActiveProfile(profileId) {
        if (!this.profiles.has(profileId)) {
            throw new Error(`Unknown brain profile: ${profileId}`);
        }
        this.activeProfileId = profileId;
    }
    getActiveProfileId() {
        return this.activeProfileId;
    }
    async scan(input) {
        const profileId = input.runtime.brainProfileId || this.activeProfileId;
        const sequence = this.profiles.get(profileId);
        if (!sequence) {
            throw new Error(`Brain profile not loaded: ${profileId}`);
        }
        const listen = input.listen ?? input.runtime.listenExpectation;
        const index = input.runtime.brainSequenceIndex;
        const mk = (name, confidence, priority, payload) => ({
            name,
            confidence: (0, brain_ranking_1.roundConfidence)(confidence),
            priority,
            rank: Math.round((1 - (0, brain_ranking_1.roundConfidence)(confidence)) * 1_000_000),
            payload: { ...payload, confidence: (0, brain_ranking_1.roundConfidence)(confidence), priority },
        });
        let candidates;
        if (index >= sequence.length) {
            candidates = [
                mk(sequence[sequence.length - 1], 1, 1_000_000, {
                    userText: input.userText,
                    exhausted: true,
                    hints: listen?.hints,
                    adapter: 'mock',
                }),
            ];
        }
        else {
            const name = sequence[index];
            input.runtime.brainSequenceIndex = index + 1;
            candidates = [
                mk(name, 1, 1_000_000, {
                    userText: input.userText,
                    sequenceIndex: index,
                    hints: listen?.hints,
                    adapter: 'mock',
                }),
            ];
        }
        if (listen?.intentions?.length) {
            for (const intent of listen.intentions) {
                if (candidates.some((c) => c.name === intent.name)) {
                    continue;
                }
                candidates.push(mk(intent.name, 0.15, intent.priority ?? conversation_history_1.DEFAULT_INTENTION_PRIORITY, {
                    userText: input.userText,
                    fromListenHint: true,
                    hints: listen.hints,
                    adapter: 'mock',
                    listenBoost: intent.boost,
                }));
            }
        }
        const extracted = (0, listen_expectation_1.mockExtractFromUserText)(input.userText, listen?.extract?.fields);
        return {
            intentions: candidates,
            extracted: Object.keys(extracted).length ? extracted : undefined,
        };
    }
    /**
     * Deterministic clarify for tests — fills required string fields from input text.
     * Empty / reserved marker input → studio.clarify.cannotAnswer.
     */
    async clarify(request) {
        const text = (0, brain_clarify_1.clarifiableInputToString)(request.input).trim();
        if (!text ||
            /^studio\.clarify\.cannotAnswer$/i.test(text) ||
            /\bcannot\s*answer\b/i.test(text)) {
            (0, brain_clarify_1.throwClarifyCannotAnswer)(!text ? 'empty_input' : 'explicit_cannot_answer');
        }
        const answer = {};
        for (const field of request.answer.fields ?? []) {
            if (field.type === 'boolean') {
                answer[field.key] = /\b(yes|true|yep)\b/i.test(text);
                continue;
            }
            if (field.type === 'number') {
                const n = text.match(/-?\d+(?:\.\d+)?/);
                answer[field.key] = n ? Number(n[0]) : null;
                continue;
            }
            if (field.type === 'object' || field.type === 'array') {
                answer[field.key] = null;
                continue;
            }
            const named = text.match(/(?:my name is|i(?:'| a)?m|call me|it(?:'| i)?s)\s+([A-Za-z][A-Za-z'-]*)/i) ?? text.match(/^([A-Za-z][A-Za-z'-]*)$/);
            answer[field.key] = named?.[1] ?? (text ? text.split(/\s+/)[0] : null);
        }
        return (0, brain_clarify_1.normalizeClarifyResult)({ answer }, request.answer);
    }
    /**
     * Deterministic judge for tests — no network.
     * Markers in context: `studio.judge.pass` / `studio.judge.fail`.
     * Otherwise: any matching failureCondition → fail; all successConditions
     * present (or none given) → pass.
     */
    async judge(request) {
        const text = (0, brain_judge_1.judgeContextToString)(request.context).trim();
        const success = request.successConditions ?? [];
        const failure = request.failureConditions ?? [];
        const haystack = text.toLowerCase();
        if (!text || /^studio\.judge\.fail$/i.test(text)) {
            return (0, brain_judge_1.normalizeJudgeResult)({
                passed: false,
                confidence: text ? 1 : 0,
                reasoning: [text ? 'explicit_fail_marker' : 'empty_context'],
            }, request.options);
        }
        if (/studio\.judge\.fail\b/i.test(text)) {
            return (0, brain_judge_1.normalizeJudgeResult)({
                passed: false,
                confidence: 1,
                reasoning: ['explicit_fail_marker'],
            }, request.options);
        }
        if (/studio\.judge\.pass\b/i.test(text)) {
            return (0, brain_judge_1.normalizeJudgeResult)({
                passed: true,
                confidence: 1,
                reasoning: ['explicit_pass_marker'],
            }, request.options);
        }
        const hitFailure = failure.filter((c) => haystack.includes(c.trim().toLowerCase()));
        if (hitFailure.length) {
            return (0, brain_judge_1.normalizeJudgeResult)({
                passed: false,
                confidence: 0.95,
                reasoning: hitFailure.map((c) => `failure_condition: ${c}`),
            }, request.options);
        }
        const missedSuccess = success.filter((c) => !haystack.includes(c.trim().toLowerCase()));
        if (missedSuccess.length) {
            return (0, brain_judge_1.normalizeJudgeResult)({
                passed: false,
                confidence: 0.8,
                reasoning: missedSuccess.map((c) => `missing_success_condition: ${c}`),
            }, request.options);
        }
        return (0, brain_judge_1.normalizeJudgeResult)({
            passed: true,
            confidence: 0.9,
            reasoning: success.length
                ? success.map((c) => `success_condition: ${c}`)
                : ['goals_assumed_met'],
        }, request.options);
    }
};
exports.MockBrainAdapter = MockBrainAdapter;
exports.MockBrainAdapter = MockBrainAdapter = __decorate([
    (0, common_1.Injectable)()
], MockBrainAdapter);
/** @deprecated Prefer MockBrainAdapter — kept for existing imports. */
class MockBrainService extends MockBrainAdapter {
}
exports.MockBrainService = MockBrainService;
//# sourceMappingURL=mock-brain.adapter.js.map