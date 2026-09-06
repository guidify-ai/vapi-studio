/** This sample never live-transfers — Guidify follows up offline. */
export function isOutboundPhoneDemo(_ctx?: unknown): boolean {
  return true;
}

/** Spoken block when transfer/mad would otherwise connect a human. */
export const OUTBOUND_DEMO_NO_TRANSFER =
  "This sample call isn't set up to transfer to a person. The Vapi Studio team will follow up with you soon. Goodbye.";
