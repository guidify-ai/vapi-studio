/**
 * Build a Vapi dashboard URL for a provider call id.
 * Studio sessions (`studio-*`) are not Vapi calls — returns null.
 *
 * Override template via `VAPI_DASHBOARD_CALL_URL` (use `{callId}` placeholder).
 */
export function vapiDashboardCallUrl(providerCallId: string): string | null {
  const id = providerCallId?.trim();
  if (!id || id.startsWith('studio-')) {
    return null;
  }
  const template =
    process.env.VAPI_DASHBOARD_CALL_URL?.trim() ||
    'https://dashboard.vapi.ai/call/{callId}';
  return template.replace(/\{callId\}/g, encodeURIComponent(id));
}

export function conversationChannel(
  providerCallId: string,
  metadata?: Record<string, unknown>,
): 'studio' | 'vapi' | 'unknown' {
  if (providerCallId.startsWith('studio-')) return 'studio';
  const startedBy = metadata?.startedBy;
  if (startedBy === 'flow-studio' || startedBy === 'flow-studio-call') {
    return 'studio';
  }
  return 'vapi';
}
