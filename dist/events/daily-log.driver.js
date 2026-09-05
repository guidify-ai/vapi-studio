"use strict";
/**
 * Daily file log driver.
 * Console stays as-is; this also appends ANSI-stripped lines to
 * `{LOG_DIR}/daily{YYYYMMDD}.log` and purges files older than LOG_DAYS (default 14).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripAnsi = stripAnsi;
exports.logYmd = logYmd;
exports.resolveLogDays = resolveLogDays;
exports.resolveLogDir = resolveLogDir;
exports.dailyLogFileName = dailyLogFileName;
exports.isFileLogEnabled = isFileLogEnabled;
exports.shouldPurgeDailyFile = shouldPurgeDailyFile;
exports.formatCallLogHeader = formatCallLogHeader;
exports.purgeOldDailyLogs = purgeOldDailyLogs;
exports.beginCallLog = beginCallLog;
exports.rememberCallerPhone = rememberCallerPhone;
exports.appendDailyLog = appendDailyLog;
exports.flushDailyLog = flushDailyLog;
exports.resetDailyLogState = resetDailyLogState;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const studio_env_1 = require("../util/studio-env");
const DEFAULT_LOG_DAYS = 14;
const FILE_RE = /^daily(\d{8})\.log$/;
const headerWritten = new Set();
const callerPhoneByCallId = new Map();
let writeChain = Promise.resolve();
let lastPurgeAt = 0;
function stripAnsi(text) {
    // eslint-disable-next-line no-control-regex -- strip terminal color codes
    return text.replace(/\u001B\[[0-9;]*m/g, '');
}
function logYmd(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}
function resolveLogDays(raw = process.env.LOG_DAYS, fallback = DEFAULT_LOG_DAYS) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1)
        return fallback;
    return Math.floor(n);
}
function resolveLogDir(raw = process.env.LOG_DIR) {
    const dir = (raw ?? 'logs').trim();
    return dir || 'logs';
}
function dailyLogFileName(date = new Date()) {
    return `daily${logYmd(date)}.log`;
}
function isFileLogEnabled() {
    if (!(0, studio_env_1.envFlag)('STUDIO_FILE_LOG', undefined, true))
        return false;
    // node:test — don't litter repo logs unless the test opted in.
    if (process.env.NODE_TEST_CONTEXT && !process.env.LOG_DIR)
        return false;
    return true;
}
function parseDailyStamp(filename) {
    const m = filename.match(FILE_RE);
    if (!m)
        return null;
    const stamp = m[1];
    const y = Number(stamp.slice(0, 4));
    const mo = Number(stamp.slice(4, 6));
    const d = Number(stamp.slice(6, 8));
    if (!y || !mo || !d)
        return null;
    return new Date(y, mo - 1, d);
}
function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function shouldPurgeDailyFile(filename, now = new Date(), logDays = resolveLogDays()) {
    const fileDate = parseDailyStamp(filename);
    if (!fileDate)
        return false;
    const ageDays = Math.floor((startOfDay(now).getTime() - startOfDay(fileDate).getTime()) / 86_400_000);
    return ageDays >= logDays;
}
function formatCallLogHeader(input) {
    const phone = input.callerPhone?.trim() ?? '';
    return [
        '--------------------',
        `Call ID: ${input.callId}`,
        `Caller Phone Number: ${phone}`,
        '',
    ].join('\n') + '\n';
}
function shouldPrintCallBannerToConsole() {
    if (process.env.NODE_TEST_CONTEXT)
        return false;
    return (0, studio_env_1.envFlag)('STUDIO_CONSOLE_DEBUG', undefined, true);
}
function enqueue(work) {
    writeChain = writeChain.then(work).catch(() => undefined);
}
async function purgeOldDailyLogs(input) {
    const dir = input?.dir ?? resolveLogDir();
    const now = input?.now ?? new Date();
    const logDays = input?.logDays ?? resolveLogDays();
    let names;
    try {
        names = await (0, promises_1.readdir)(dir);
    }
    catch {
        return [];
    }
    const removed = [];
    for (const name of names) {
        if (!shouldPurgeDailyFile(name, now, logDays))
            continue;
        try {
            await (0, promises_1.unlink)((0, path_1.join)(dir, name));
            removed.push(name);
        }
        catch {
            // ignore
        }
    }
    return removed;
}
async function ensurePurged(dir) {
    const now = Date.now();
    if (now - lastPurgeAt < 60_000)
        return;
    lastPurgeAt = now;
    await (0, promises_1.mkdir)(dir, { recursive: true });
    await purgeOldDailyLogs({ dir });
}
function callIdFromPayload(payload) {
    if (!payload)
        return null;
    for (const key of ['providerCallId', 'callId', 'call_id']) {
        const v = payload[key];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    return null;
}
/**
 * Record caller phone (from Vapi webhook) and write the per-call banner once.
 */
function beginCallLog(input) {
    if (!input.callId)
        return;
    if (input.callerPhone?.trim()) {
        callerPhoneByCallId.set(input.callId, input.callerPhone.trim());
    }
    if (headerWritten.has(input.callId))
        return;
    headerWritten.add(input.callId);
    const phone = callerPhoneByCallId.get(input.callId) ?? input.callerPhone;
    const banner = formatCallLogHeader({
        callId: input.callId,
        callerPhone: phone,
    });
    if (shouldPrintCallBannerToConsole()) {
        process.stdout.write(banner);
    }
    if (!isFileLogEnabled())
        return;
    enqueue(async () => {
        const dir = resolveLogDir();
        await ensurePurged(dir);
        await (0, promises_1.appendFile)((0, path_1.join)(dir, dailyLogFileName()), banner, 'utf8');
    });
}
function rememberCallerPhone(callId, callerPhone) {
    if (!callId || !callerPhone?.trim())
        return;
    callerPhoneByCallId.set(callId, callerPhone.trim());
}
function appendDailyLog(lines, payload) {
    if (!isFileLogEnabled() || !lines.length)
        return;
    const callId = callIdFromPayload(payload);
    if (callId && !headerWritten.has(callId)) {
        beginCallLog({
            callId,
            callerPhone: (typeof payload?.callerPhoneNumber === 'string'
                ? payload.callerPhoneNumber
                : null) ?? callerPhoneByCallId.get(callId),
        });
    }
    const text = `${lines.map(stripAnsi).join('\n')}\n`;
    enqueue(async () => {
        const dir = resolveLogDir();
        await ensurePurged(dir);
        await (0, promises_1.appendFile)((0, path_1.join)(dir, dailyLogFileName()), text, 'utf8');
    });
}
/** Test helper — wait until queued writes finish. */
function flushDailyLog() {
    return writeChain;
}
/** Test helper — reset in-memory call banners. */
function resetDailyLogState() {
    headerWritten.clear();
    callerPhoneByCallId.clear();
    lastPurgeAt = 0;
}
//# sourceMappingURL=daily-log.driver.js.map