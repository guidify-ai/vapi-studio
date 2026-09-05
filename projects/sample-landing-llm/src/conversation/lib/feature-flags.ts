/**
 * Roofr PoC feature flags — defaults off unless catalog / override / env says on.
 */

export const FF_RECOGNIZE_RETURNING_CALLER = 'recognizeReturningCaller';

export interface FeatureFlagDefinition {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

/** Source of truth for registered flags (Studio catalog + runtime defaults). */
export const FEATURE_FLAG_CATALOG: FeatureFlagDefinition[] = [
  {
    id: FF_RECOGNIZE_RETURNING_CALLER,
    label: 'Recognize returning caller',
    description:
      'Off by default (dev). When on, preload named profiles and ask “I see {firstName} is calling back…”. When off, treat every call as new for recognition UX (profile still saves).',
    defaultEnabled: false,
  },
];

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

/** Catalog defaults, then env opt-ins, then metadata / Studio overrides. */
export function resolveFeatureFlags(
  overrides: Record<string, boolean> | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of FEATURE_FLAG_CATALOG) {
    out[f.id] = f.defaultEnabled === true;
  }
  if (process.env.POC_FF_RECOGNIZE_RETURNING_CALLER === 'true') {
    out[FF_RECOGNIZE_RETURNING_CALLER] = true;
  }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      out[k] = v === true;
    }
  }
  return out;
}
