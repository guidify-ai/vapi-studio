import { STANDARD_INTENTIONS, type ListenIntentionBoost } from '@guidify-ai/vapi-studio';

/** Standard portal boosts shared by estimate Nodes. */
export function portalBoosts(): ListenIntentionBoost[] {
  return [
    { name: STANDARD_INTENTIONS.isMad, boost: 15 },
    { name: STANDARD_INTENTIONS.isTransferToHuman, boost: 8 },
    { name: STANDARD_INTENTIONS.isStillThere, boost: 4 },
    { name: STANDARD_INTENTIONS.isPause, boost: 5 },
    { name: STANDARD_INTENTIONS.isGoodbye, boost: 3 },
  ];
}
