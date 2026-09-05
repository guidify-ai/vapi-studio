"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyListenBoosts = applyListenBoosts;
exports.mergeSayAndListenOptions = mergeSayAndListenOptions;
exports.tryResolveListenIntention = tryResolveListenIntention;
exports.missingRequiredExtractKeys = missingRequiredExtractKeys;
exports.mockExtractPersonName = mockExtractPersonName;
exports.mockExtractFromUserText = mockExtractFromUserText;
function applyListenBoosts(candidates, listen) {
    if (!listen?.intentions?.length) {
        return candidates;
    }
    const boostByName = new Map(listen.intentions.map((i) => [i.name, i.boost ?? 10]));
    return candidates.map((c) => {
        const boost = boostByName.get(c.name);
        if (boost == null) {
            return c;
        }
        return {
            ...c,
            rank: c.rank - boost,
            payload: typeof c.payload === 'object' && c.payload
                ? { ...c.payload, listenBoost: boost }
                : { listenBoost: boost },
        };
    });
}
/**
 * Merge `sayAndListen` options into the listen registered by `node.listen()`.
 * Extract spec on sayAndListen wins for the upcoming user answer.
 */
function mergeSayAndListenOptions(current, options) {
    if (!options) {
        return current ?? null;
    }
    const base = current ?? { intentions: [] };
    return {
        intentions: options.intentions ?? base.intentions,
        hints: options.hints ?? base.hints,
        note: options.note ?? base.note,
        extract: options.extract !== undefined ? options.extract : base.extract,
        timeoutSeconds: options.timeoutSeconds !== undefined
            ? options.timeoutSeconds
            : base.timeoutSeconds,
        interruptible: options.interruptible !== undefined
            ? options.interruptible
            : base.interruptible,
        resolveIntention: options.resolveIntention !== undefined
            ? options.resolveIntention
            : base.resolveIntention,
    };
}
/**
 * Run a listen's cheap matcher. Returns an intention name only when it is
 * listed on this listen. Null → Brain scan as usual.
 */
async function tryResolveListenIntention(input) {
    const listen = input.listen;
    if (!listen?.resolveIntention) {
        return null;
    }
    const name = await listen.resolveIntention({
        userText: input.userText,
        memory: input.memory,
    });
    if (!name || typeof name !== 'string') {
        return null;
    }
    const allowed = new Set(listen.intentions.map((i) => i.name));
    if (!allowed.has(name)) {
        return null;
    }
    return name;
}
function missingRequiredExtractKeys(fields, extracted) {
    if (!fields?.length) {
        return [];
    }
    return fields
        .filter((f) => f.required)
        .filter((f) => {
        const v = extracted?.[f.key];
        return v === undefined || v === null || v === '';
    })
        .map((f) => f.key);
}
/** Pronouns / fillers that must never be treated as a person name. */
const MOCK_NAME_STOPWORDS = new Set([
    'i',
    'me',
    'my',
    'you',
    'we',
    'they',
    'he',
    'she',
    'it',
    'a',
    'an',
    'the',
    'yes',
    'no',
    'ok',
    'okay',
    'yeah',
    'yep',
    'yup',
    'please',
    'hi',
    'hello',
    'hey',
    'um',
    'uh',
    'erm',
    'and',
    'or',
    'so',
]);
const MOCK_NAME_INTENT_WORDS = new Set([
    'need',
    'want',
    'estimate',
    'roof',
    'roofs',
    'help',
    'calling',
    'about',
    'appointment',
    'quote',
    'today',
]);
const NAME_TOKEN_RE = /^[A-Za-z][A-Za-z'-]{0,30}$/;
function isNameLikeExtractKey(key) {
    return /name/i.test(key);
}
function stripAsrNameNoise(text) {
    return text
        .trim()
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/[.,!?;:]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function nameTokensFromUtterance(userText) {
    const text = stripAsrNameNoise(userText);
    if (!text)
        return undefined;
    const phrase = text.match(/(?:my name is|i(?:'| a)?m|call me|it(?:'| i)?s)\s+([A-Za-z][A-Za-z'-]*)/i);
    if (phrase && !MOCK_NAME_STOPWORDS.has(phrase[1].toLowerCase())) {
        return [phrase[1]];
    }
    const raw = text.split(/\s+/);
    if (raw.some((t) => MOCK_NAME_INTENT_WORDS.has(t.toLowerCase()))) {
        return undefined;
    }
    const names = raw
        .map((t) => t.replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, ''))
        .filter((t) => NAME_TOKEN_RE.test(t))
        .filter((t) => !MOCK_NAME_STOPWORDS.has(t.toLowerCase()));
    if (!names.length || names.length > 3)
        return undefined;
    return names;
}
/**
 * Pull a plausible person name from ASR text.
 * Accepts "Mark." / "yeah Mark" from voice ASR. Rejects pronouns and
 * intent sentences (e.g. "I need my roof estimate").
 */
function mockExtractPersonName(userText, prefer = 'first') {
    const names = nameTokensFromUtterance(userText);
    if (!names?.length)
        return undefined;
    return prefer === 'last' ? names[names.length - 1] : names[0];
}
/**
 * Deterministic mock extraction for tests / MockBrain (no LLM).
 */
function mockExtractFromUserText(userText, fields) {
    const out = {};
    if (!fields?.length) {
        return out;
    }
    const text = userText.trim();
    for (const field of fields) {
        if (field.type === 'number') {
            const n = text.match(/-?\d+(?:\.\d+)?/);
            if (n)
                out[field.key] = Number(n[0]);
            continue;
        }
        if (field.type === 'boolean') {
            const lower = text.toLowerCase();
            if (/\b(yes|yeah|yep|true)\b/.test(lower))
                out[field.key] = true;
            else if (/\b(no|nope|false)\b/.test(lower))
                out[field.key] = false;
            continue;
        }
        if (isNameLikeExtractKey(field.key)) {
            const prefer = /last|family|surname/i.test(field.key) ? 'last' : 'first';
            const name = mockExtractPersonName(text, prefer);
            if (name)
                out[field.key] = name;
            continue;
        }
        const named = mockExtractPersonName(text);
        if (named) {
            out[field.key] = named;
        }
        else if (text) {
            const cleaned = stripAsrNameNoise(text);
            const first = cleaned.split(/\s+/)[0];
            if (first)
                out[field.key] = first;
        }
    }
    return out;
}
//# sourceMappingURL=listen-expectation.js.map