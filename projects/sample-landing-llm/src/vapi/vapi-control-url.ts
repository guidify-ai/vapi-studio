/** Pull Vapi Live Call Control URL from webhook / Custom LLM payloads. */
export function extractVapiControlUrl(
  raw: Record<string, unknown>,
): string | null {
  const fromMonitor = (obj: unknown): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    const monitor = (obj as { monitor?: unknown }).monitor;
    if (!monitor || typeof monitor !== 'object') return null;
    const url = (monitor as { controlUrl?: unknown }).controlUrl;
    return typeof url === 'string' && url.startsWith('http') ? url : null;
  };

  const call = raw.call;
  const direct = fromMonitor(call);
  if (direct) return direct;

  const message = raw.message;
  if (message && typeof message === 'object') {
    const nested = fromMonitor((message as { call?: unknown }).call);
    if (nested) return nested;
  }

  return fromMonitor(raw);
}
