/**
 * Optional app-owned event hooks (private modules gitignored).
 * Call from `main.ts` before listen.
 */
export function registerEventShadows(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./event-export');
  } catch {
    /* no private exporter */
  }
}
