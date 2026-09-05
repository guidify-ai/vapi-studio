import {
  GREETING_AB_TEST_ID,
  type AbVariant,
} from '../conversation/lib/ab-tests';
import { FEATURE_FLAG_CATALOG } from '../conversation/lib/feature-flags';

/** Studio preset catalog — toggles applied at Call start via metadata. */

export interface StudioAbTestPreset {
  id: string;
  label: string;
  variants: AbVariant[];
  /** Sticky assignment lives on caller_profiles when override is unset. */
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
  abTests: [
    {
      id: GREETING_AB_TEST_ID,
      label: 'Greeting',
      variants: ['A', 'B'],
      description:
        'Sticky per caller when Auto. Override forces A or B for this Call only. Returning copy names {firstName} and stays professional.',
    },
  ],
  featureFlags: FEATURE_FLAG_CATALOG.map((f) => ({ ...f })),
};

export type AbOverrideMap = Record<string, AbVariant | 'auto'>;
export type FeatureFlagOverrideMap = Record<string, boolean>;

export interface StudioCallPresets {
  afterHours?: boolean;
  /** testId → A | B | auto (omit / auto = sticky assignment). */
  abOverrides?: AbOverrideMap;
  /** flagId → forced on/off for this Conversation. */
  featureFlagOverrides?: FeatureFlagOverrideMap;
}
