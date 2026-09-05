/** Pull LP intake fields from Vapi call / assistant metadata bags. */
export function extractPlannerIntakeMetadata(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  const call = (raw.call && typeof raw.call === 'object'
    ? raw.call
    : undefined) as Record<string, unknown> | undefined;
  const bags: Array<Record<string, unknown> | undefined> = [
    raw.metadata as Record<string, unknown> | undefined,
    call?.metadata as Record<string, unknown> | undefined,
    (raw.assistant as { metadata?: Record<string, unknown> } | undefined)
      ?.metadata,
    (
      raw.assistantOverrides as
        | { metadata?: Record<string, unknown>; variableValues?: Record<string, unknown> }
        | undefined
    )?.metadata,
    (
      raw.assistantOverrides as
        | { variableValues?: Record<string, unknown> }
        | undefined
    )?.variableValues,
  ];
  const out: Record<string, unknown> = {};
  for (const bag of bags) {
    if (!bag || typeof bag !== 'object') continue;
    for (const key of [
      'contactName',
      'contactEmail',
      'guestCompanyName',
      'companyName',
      'consentOutboundCall',
      'outbound',
    ] as const) {
      if (out[key] == null && bag[key] != null && bag[key] !== '') {
        out[key] = bag[key];
      }
    }
  }
  return out;
}
