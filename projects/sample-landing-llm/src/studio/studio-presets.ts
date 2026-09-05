import { FEATURE_FLAG_CATALOG } from '../conversation/lib/feature-flags';

/** Studio preset catalog — toggles applied at Call start via metadata. */

export type AbVariant = 'A' | 'B';

export interface StudioAbTestPreset {
  id: string;
  label: string;
  variants: AbVariant[];
  description: string;
}

export interface StudioFeatureFlagPreset {
  id: string;
  label: string;
  description: string;
  /** Default when no override is set. */
  defaultEnabled: boolean;
}

export interface StudioPresetsCatalog {
  afterHours: {
    id: 'afterHours';
    label: string;
    description: string;
  };
  /** Planner sample has no sticky A/B greeting variants. */
  abTests: StudioAbTestPreset[];
  featureFlags: StudioFeatureFlagPreset[];
}

export const STUDIO_PRESETS_CATALOG: StudioPresetsCatalog = {
  afterHours: {
    id: 'afterHours',
    label: 'After hours call',
    description:
      'Marks the Conversation as outside working hours — human transfer is blocked.',
  },
  abTests: [],
  featureFlags: FEATURE_FLAG_CATALOG.map((f) => ({ ...f })),
};

export type AbOverrideMap = Record<string, AbVariant | 'auto'>;
export type FeatureFlagOverrideMap = Record<string, boolean>;

export interface StudioCallPresets {
  afterHours?: boolean;
  /** Unused on planner — kept for Studio UI / API shape parity with other apps. */
  abOverrides?: AbOverrideMap;
  /** flagId → forced on/off for this Conversation. */
  featureFlagOverrides?: FeatureFlagOverrideMap;
}
