/**
 * Prefer Studio env names; accept legacy aliases for existing deploys.
 * Docs and new apps should use the Studio names only.
 */
export function envFlag(
  primary: string,
  legacy: string | undefined,
  defaultOn: boolean,
): boolean {
  const raw = (
    process.env[primary] ??
    (legacy ? process.env[legacy] : undefined) ??
    (defaultOn ? '1' : '0')
  )
    .trim()
    .toLowerCase();
  if (defaultOn) {
    return !['0', 'false', 'no', 'off'].includes(raw);
  }
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

export function envString(
  primary: string,
  legacy: string | undefined,
  fallback: string,
): string {
  const v = process.env[primary] ?? (legacy ? process.env[legacy] : undefined);
  if (v === undefined || v === null) return fallback;
  const t = String(v).trim();
  return t.length ? t : fallback;
}

export function envNumber(
  primary: string,
  legacy: string | undefined,
  fallback: number,
): number {
  const raw = process.env[primary] ?? (legacy ? process.env[legacy] : undefined);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
