/**
 * Color-coded conversation console for live call debugging.
 * Toggle with STUDIO_CONSOLE_DEBUG=1|true|yes (default: on unless explicitly 0|false|no|off).
 */
export type StudioLogLevel = 'debug' | 'info' | 'warn' | 'error';
/**
 * User-facing memory for console diffs / turn forensics.
 * Keep conversation-critical flags (e.g. `introSpoken`) — hiding them made
 * greeting-reset bugs invisible in MEMORY diffs. Only skip bootstrap infra.
 */
export declare function snapshotUserMemory(memory: Record<string, unknown> | undefined | null): Record<string, unknown>;
export declare function isConversationConsoleEnabled(): boolean;
/**
 * Pretty-print a structured Vapi Studio event to stdout with role colors.
 */
export declare function printConversationConsole(level: StudioLogLevel, type: string, payload: Record<string, unknown>): void;
//# sourceMappingURL=conversation-console.d.ts.map