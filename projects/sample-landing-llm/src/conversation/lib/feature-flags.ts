/**
 * Planner Studio feature flags — defaults off unless catalog / override / env says on.
 * Toggle from /studio presets (optional demos — not required for the happy path).
 */

/** After the first sample reveal, append a soft Guidify-scope hint (not a quote). */
export const FF_SAMPLE_SCOPE_HINT = 'sampleScopeHint';

export interface FeatureFlagDefinition {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

/** Source of truth for registered flags (Studio catalog + runtime defaults). */
export const FEATURE_FLAG_CATALOG: FeatureFlagDefinition[] = [
  {
    id: FF_SAMPLE_SCOPE_HINT,
    label: 'Sample scope hint',
    description:
      'When on, the first sample reveal adds one short line that first modules like this are usually a focused Guidify scope — still no prices in chat.',
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
  if (process.env.POC_FF_SAMPLE_SCOPE_HINT === 'true') {
    out[FF_SAMPLE_SCOPE_HINT] = true;
  }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      out[k] = v === true;
    }
  }
  return out;
}

export const SAMPLE_SCOPE_HINT_LINE =
  'First modules like this usually land in a focused Guidify scope — say Help me build it if you want a real quote.';
