"use strict";
/**
 * Brain clarify — ask a free-form question with a required object answer shape.
 * Used when the flow has an ambiguous / incomplete answer and needs a Brain judgment.
 *
 * Reserved failure: throws ClarifyCannotAnswerError (`studio.clarify.cannotAnswer`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClarifyCannotAnswerError = exports.STUDIO_CLARIFY_CANNOT_ANSWER = void 0;
exports.isClarifyCannotAnswerError = isClarifyCannotAnswerError;
exports.throwClarifyCannotAnswer = throwClarifyCannotAnswer;
exports.normalizeClarifyResult = normalizeClarifyResult;
exports.clarifiableInputToString = clarifiableInputToString;
exports.emptyAnswerFromInterface = emptyAnswerFromInterface;
exports.filterClarifyAnswer = filterClarifyAnswer;
const prompt_injection_guard_1 = require("./prompt-injection-guard");
/** Reserved clarify exception code — Brain cannot produce a reliable answer. */
exports.STUDIO_CLARIFY_CANNOT_ANSWER = 'studio.clarify.cannotAnswer';
/**
 * Reserved exception thrown by Brain.clarify when it cannot answer.
 * Catch this in Node.run / Node.catch to recover (restartNode, forceIntention, …).
 */
class ClarifyCannotAnswerError extends Error {
    code = exports.STUDIO_CLARIFY_CANNOT_ANSWER;
    reason;
    details;
    constructor(reason, details) {
        super(reason
            ? `${exports.STUDIO_CLARIFY_CANNOT_ANSWER}: ${reason}`
            : exports.STUDIO_CLARIFY_CANNOT_ANSWER);
        this.name = 'ClarifyCannotAnswerError';
        this.reason = reason;
        this.details = details;
    }
}
exports.ClarifyCannotAnswerError = ClarifyCannotAnswerError;
function isClarifyCannotAnswerError(error) {
    return (error instanceof ClarifyCannotAnswerError ||
        (typeof error === 'object' &&
            error !== null &&
            error.code === exports.STUDIO_CLARIFY_CANNOT_ANSWER));
}
/** Throw the reserved cannot-answer exception. */
function throwClarifyCannotAnswer(reason, details) {
    throw new ClarifyCannotAnswerError(reason, details);
}
function requiredFieldsMissing(answer, answerInterface) {
    const required = (answerInterface.fields ?? []).filter((f) => f.required);
    if (!required.length) {
        return false;
    }
    return required.every((f) => {
        const v = answer[f.key];
        return v === undefined || v === null || v === '';
    });
}
/**
 * Normalize raw Brain JSON into a successful clarify result,
 * or throw ClarifyCannotAnswerError (reserved).
 *
 * Accepts:
 * - `{ outcome: "studio.clarify.cannotAnswer", reason? }` → throw
 * - `{ cannotAnswer: true, reason? }` → throw
 * - `{ answer: {...} }` / `{ outcome: "answered", answer: {...} }`
 */
function normalizeClarifyResult(raw, answerInterface) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throwClarifyCannotAnswer('invalid_clarify_payload');
    }
    const obj = raw;
    if (obj.outcome === exports.STUDIO_CLARIFY_CANNOT_ANSWER ||
        obj.outcome === 'studio.clarify.cannotAnswer' ||
        obj.cannotAnswer === true) {
        throwClarifyCannotAnswer(typeof obj.reason === 'string' ? obj.reason : undefined);
    }
    let answerRaw;
    if (obj.answer &&
        typeof obj.answer === 'object' &&
        !Array.isArray(obj.answer)) {
        answerRaw = obj.answer;
    }
    else if ('outcome' in obj || 'cannotAnswer' in obj) {
        throwClarifyCannotAnswer(typeof obj.reason === 'string' ? obj.reason : 'missing_answer');
    }
    else {
        answerRaw = obj;
    }
    const filtered = filterClarifyAnswer(answerRaw, answerInterface);
    if (requiredFieldsMissing(filtered, answerInterface)) {
        throwClarifyCannotAnswer('required_fields_missing', {
            answer: filtered,
        });
    }
    return { answer: filtered };
}
function clarifiableInputToString(input) {
    if (input === null || input === undefined) {
        return '';
    }
    if (typeof input === 'string') {
        return input;
    }
    if (typeof input === 'number' ||
        typeof input === 'boolean' ||
        typeof input === 'bigint') {
        return String(input);
    }
    if (input instanceof Date) {
        return input.toISOString();
    }
    try {
        return String(input);
    }
    catch {
        return '';
    }
}
function emptyAnswerFromInterface(answer) {
    const out = {};
    for (const field of answer.fields ?? []) {
        out[field.key] = null;
    }
    return out;
}
/** Keep only keys declared on the answer interface; sanitize string values fail-closed. */
function filterClarifyAnswer(raw, answer) {
    const out = {};
    const allowed = new Set((answer.fields ?? []).map((f) => f.key));
    if (!raw || typeof raw !== 'object') {
        return out;
    }
    for (const [key, value] of Object.entries(raw)) {
        if (!allowed.has(key))
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
    return out;
}
//# sourceMappingURL=brain-clarify.js.map