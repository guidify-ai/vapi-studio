/** Flow node labels + analytics tags for branch dashboards. */
export interface FlowNodeMeta {
  label: string;
  lane: 'open' | 'identity' | 'appointment' | 'instant' | 'close' | 'portal';
  tag?: string;
}

export const FLOW_NODE_CATALOG: Record<string, FlowNodeMeta> = {
  acknowledge: { label: 'Greet', lane: 'open', tag: 'greeted' },
  routerTriage: { label: 'Router', lane: 'open' },
  existingProject: { label: 'Existing job', lane: 'open' },
  askFormSendConsent: { label: 'Form consent', lane: 'identity', tag: 'form_consent' },
  askSmsPhone: { label: 'SMS phone', lane: 'identity' },
  identityCollect: { label: 'Identity', lane: 'identity', tag: 'identity_confirmed' },
  promptAddress: { label: 'Address', lane: 'appointment' },
  resolveAddress: { label: 'Resolve addr', lane: 'appointment' },
  confirmAddressMatch: { label: 'Confirm addr', lane: 'appointment' },
  rejectAddressMatch: { label: 'Reject addr', lane: 'appointment' },
  askAppointmentAvailability: { label: 'Ask appt time', lane: 'appointment' },
  declineAppointment: { label: 'Decline appt', lane: 'appointment' },
  checkAvailability: { label: 'Check slots', lane: 'appointment' },
  rejectAppointmentSlot: { label: 'Reject slot', lane: 'appointment' },
  bookAppointment: { label: 'Book appt', lane: 'appointment', tag: 'appointment_booked' },
  confirmEmail: { label: 'Confirm email', lane: 'appointment' },
  appointmentDone: { label: 'Appt done', lane: 'appointment' },
  offerInstantEstimate: { label: 'Offer estimate', lane: 'instant', tag: 'chose_instant_estimate' },
  askTimeline: { label: 'Timeline', lane: 'instant' },
  askSlope: { label: 'Roof slope', lane: 'instant' },
  rejectSlope: { label: 'Reject slope', lane: 'instant' },
  deliverEstimate: { label: 'Deliver est.', lane: 'instant', tag: 'estimate_delivered' },
  instantDone: { label: 'Estimate done', lane: 'instant' },
  farewell: { label: 'Farewell', lane: 'close', tag: 'call_ended' },
  goodbye: { label: 'Goodbye', lane: 'close', tag: 'call_ended' },
  pause: { label: 'Pause', lane: 'portal' },
  mad: { label: 'Mad', lane: 'portal', tag: 'mad' },
  unknownTransition: { label: 'Unknown', lane: 'portal', tag: 'unknown' },
  transferToHuman: { label: 'Transfer', lane: 'portal', tag: 'transfer' },
  stillThere: { label: 'Still there', lane: 'portal', tag: 'still_there' },
  continue: { label: 'Continue', lane: 'portal' },
  roofEstimateIntent: { label: 'Estimate intent', lane: 'open', tag: 'intent_estimate' },
};

export function nodeLabel(nodeId: string): string {
  return FLOW_NODE_CATALOG[nodeId]?.label ?? nodeId;
}

export function nodeLane(nodeId: string): FlowNodeMeta['lane'] {
  return FLOW_NODE_CATALOG[nodeId]?.lane ?? 'open';
}
