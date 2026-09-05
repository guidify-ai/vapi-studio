"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envFlag = envFlag;
exports.envString = envString;
exports.envNumber = envNumber;
/**
 * Studio env helpers. Prefer `STUDIO_*` names in apps and docs.
 */
function envFlag(primary, legacy, defaultOn) {
    const raw = (process.env[primary] ??
        (legacy ? process.env[legacy] : undefined) ??
        (defaultOn ? '1' : '0'))
        .trim()
        .toLowerCase();
    if (defaultOn) {
        return !['0', 'false', 'no', 'off'].includes(raw);
    }
    return ['1', 'true', 'yes', 'on'].includes(raw);
}
function envString(primary, legacy, fallback) {
    const v = process.env[primary] ?? (legacy ? process.env[legacy] : undefined);
    if (v === undefined || v === null)
        return fallback;
    const t = String(v).trim();
    return t.length ? t : fallback;
}
function envNumber(primary, legacy, fallback) {
    const raw = process.env[primary] ?? (legacy ? process.env[legacy] : undefined);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
//# sourceMappingURL=studio-env.js.map