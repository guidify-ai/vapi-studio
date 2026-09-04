/**
 * Daily file log driver.
 * Console stays as-is; this also appends ANSI-stripped lines to
 * `{LOG_DIR}/daily{YYYYMMDD}.log` and purges files older than LOG_DAYS (default 14).
 */

import { appendFile, mkdir, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { envFlag } from '../util/studio-env';

const DEFAULT_LOG_DAYS = 14;
const FILE_RE = /^daily(\d{8})\.log$/;

const headerWritten = new Set<string>();
const callerPhoneByCallId = new Map<string, string>();
let writeChain: Promise<void> = Promise.resolve();
let lastPurgeAt = 0;

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex -- strip terminal color codes
  return text.replace(/\u001B\[[0-9;]*m/g, '');
}

export function logYmd(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function resolveLogDays(
  raw = process.env.LOG_DAYS,
  fallback = DEFAULT_LOG_DAYS,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function resolveLogDir(raw = process.env.LOG_DIR): string {
  const dir = (raw ?? 'logs').trim();
  return dir || 'logs';
}

export function dailyLogFileName(date = new Date()): string {
  return `daily${logYmd(date)}.log`;
}

export function isFileLogEnabled(): boolean {
  if (!envFlag('STUDIO_FILE_LOG', 'RA9_FILE_LOG', true)) return false;
  // node:test — don't litter repo logs unless the test opted in.
  if (process.env.NODE_TEST_CONTEXT && !process.env.LOG_DIR) return false;
  return true;
}

function parseDailyStamp(filename: string): Date | null {
  const m = filename.match(FILE_RE);
  if (!m) return null;
  const stamp = m[1];
  const y = Number(stamp.slice(0, 4));
  const mo = Number(stamp.slice(4, 6));
  const d = Number(stamp.slice(6, 8));
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shouldPurgeDailyFile(
  filename: string,
  now = new Date(),
  logDays = resolveLogDays(),
): boolean {
  const fileDate = parseDailyStamp(filename);
  if (!fileDate) return false;
  const ageDays = Math.floor(
    (startOfDay(now).getTime() - startOfDay(fileDate).getTime()) / 86_400_000,
  );
  return ageDays >= logDays;
}

export function formatCallLogHeader(input: {
  callId: string;
  callerPhone?: string | null;
}): string {
  const phone = input.callerPhone?.trim() ?? '';
  return [
    '--------------------',
    `Call ID: ${input.callId}`,
    `Caller Phone Number: ${phone}`,
    '',
  ].join('\n') + '\n';
}

function shouldPrintCallBannerToConsole(): boolean {
  if (process.env.NODE_TEST_CONTEXT) return false;
  return envFlag('STUDIO_CONSOLE_DEBUG', 'RA9_CONSOLE_DEBUG', true);
}

function enqueue(work: () => Promise<void>): void {
  writeChain = writeChain.then(work).catch(() => undefined);
}

export async function purgeOldDailyLogs(input?: {
  dir?: string;
  now?: Date;
  logDays?: number;
}): Promise<string[]> {
  const dir = input?.dir ?? resolveLogDir();
  const now = input?.now ?? new Date();
  const logDays = input?.logDays ?? resolveLogDays();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const name of names) {
    if (!shouldPurgeDailyFile(name, now, logDays)) continue;
    try {
      await unlink(join(dir, name));
      removed.push(name);
    } catch {
      // ignore
    }
  }
  return removed;
}

async function ensurePurged(dir: string): Promise<void> {
  const now = Date.now();
  if (now - lastPurgeAt < 60_000) return;
  lastPurgeAt = now;
  await mkdir(dir, { recursive: true });
  await purgeOldDailyLogs({ dir });
}

function callIdFromPayload(
  payload: Record<string, unknown> | undefined,
): string | null {
  if (!payload) return null;
  for (const key of ['providerCallId', 'callId', 'call_id']) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Record caller phone (from Vapi webhook) and write the per-call banner once.
 */
export function beginCallLog(input: {
  callId: string;
  callerPhone?: string | null;
}): void {
  if (!input.callId) return;
  if (input.callerPhone?.trim()) {
    callerPhoneByCallId.set(input.callId, input.callerPhone.trim());
  }
  if (headerWritten.has(input.callId)) return;
  headerWritten.add(input.callId);
  const phone = callerPhoneByCallId.get(input.callId) ?? input.callerPhone;
  const banner = formatCallLogHeader({
    callId: input.callId,
    callerPhone: phone,
  });
  if (shouldPrintCallBannerToConsole()) {
     
    process.stdout.write(banner);
  }
  if (!isFileLogEnabled()) return;
  enqueue(async () => {
    const dir = resolveLogDir();
    await ensurePurged(dir);
    await appendFile(join(dir, dailyLogFileName()), banner, 'utf8');
  });
}

export function rememberCallerPhone(
  callId: string,
  callerPhone: string | null | undefined,
): void {
  if (!callId || !callerPhone?.trim()) return;
  callerPhoneByCallId.set(callId, callerPhone.trim());
}

export function appendDailyLog(
  lines: string[],
  payload?: Record<string, unknown>,
): void {
  if (!isFileLogEnabled() || !lines.length) return;
  const callId = callIdFromPayload(payload);
  if (callId && !headerWritten.has(callId)) {
    beginCallLog({
      callId,
      callerPhone:
        (typeof payload?.callerPhoneNumber === 'string'
          ? payload.callerPhoneNumber
          : null) ?? callerPhoneByCallId.get(callId),
    });
  }
  const text = `${lines.map(stripAnsi).join('\n')}\n`;
  enqueue(async () => {
    const dir = resolveLogDir();
    await ensurePurged(dir);
    await appendFile(join(dir, dailyLogFileName()), text, 'utf8');
  });
}

/** Test helper — wait until queued writes finish. */
export function flushDailyLog(): Promise<void> {
  return writeChain;
}

/** Test helper — reset in-memory call banners. */
export function resetDailyLogState(): void {
  headerWritten.clear();
  callerPhoneByCallId.clear();
  lastPurgeAt = 0;
}
