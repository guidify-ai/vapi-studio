/**
 * Daily file log driver.
 * Console stays as-is; this also appends ANSI-stripped lines to
 * `{LOG_DIR}/daily{YYYYMMDD}.log` and purges files older than LOG_DAYS (default 14).
 */
export declare function stripAnsi(text: string): string;
export declare function logYmd(date?: Date): string;
export declare function resolveLogDays(raw?: string | undefined, fallback?: number): number;
export declare function resolveLogDir(raw?: string | undefined): string;
export declare function dailyLogFileName(date?: Date): string;
export declare function isFileLogEnabled(): boolean;
export declare function shouldPurgeDailyFile(filename: string, now?: Date, logDays?: number): boolean;
export declare function formatCallLogHeader(input: {
    callId: string;
    callerPhone?: string | null;
}): string;
export declare function purgeOldDailyLogs(input?: {
    dir?: string;
    now?: Date;
    logDays?: number;
}): Promise<string[]>;
/**
 * Record caller phone (from Vapi webhook) and write the per-call banner once.
 */
export declare function beginCallLog(input: {
    callId: string;
    callerPhone?: string | null;
}): void;
export declare function rememberCallerPhone(callId: string, callerPhone: string | null | undefined): void;
export declare function appendDailyLog(lines: string[], payload?: Record<string, unknown>): void;
/** Test helper — wait until queued writes finish. */
export declare function flushDailyLog(): Promise<void>;
/** Test helper — reset in-memory call banners. */
export declare function resetDailyLogState(): void;
//# sourceMappingURL=daily-log.driver.d.ts.map