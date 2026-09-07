/**
 * Studio feature flags — catalog empty for the phone-demo sample.
 * Keep resolve helpers so Call presets / metadata stay stable if flags return later.
 */

export interface FeatureFlagDefinition {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

/** Source of truth for registered flags (Studio catalog + runtime defaults). */
export const FEATURE_FLAG_CATALOG: FeatureFlagDefinition[] = [];

export function isFeatureEnabled(
  flags: Record<string, boolean> | undefined,
  id: string,
  defaultEnabled = false,
): boolean {
  if (flags && Object.prototype.hasOwnProperty.call(flags, id)) {
    return flags[id] === true;
  }
  return defaultEnabled;
}

/** Catalog defaults, then metadata / Studio overrides. */
export function resolveFeatureFlags(
  overrides: Record<string, boolean> | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of FEATURE_FLAG_CATALOG) {
    out[f.id] = f.defaultEnabled === true;
  }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      out[k] = v === true;
    }
  }
  return out;
}
