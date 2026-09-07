import { api } from '../lib/api';
import type {
  FlowDiagramGraph,
  FormExposeHandle,
  StudioPresetsCatalog,
  StudioTurnView,
} from './types';

export function getGraph() {
  return api<FlowDiagramGraph>('/flow/graph');
}

export function saveEdges(
  edges: Array<{ source: string; target: string; label?: string }>,
) {
  return api<{ ok: true; count: number }>('/flow/edges', {
    method: 'PUT',
    body: JSON.stringify({ edges }),
  });
}

export function getPresets() {
  return api<StudioPresetsCatalog>('/studio/presets');
}

export function startCall(body: {
  callerId: string;
  afterHours?: boolean;
  abOverrides?: Record<string, string>;
  featureFlagOverrides?: Record<string, boolean>;
}) {
  return api<StudioTurnView>('/studio/conversations/call', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function sendTurn(id: string, text: string) {
  return api<StudioTurnView>(
    `/studio/conversations/${encodeURIComponent(id)}/turns`,
    { method: 'POST', body: JSON.stringify({ text }) },
  );
}

export function idleTurn(id: string) {
  return api<StudioTurnView>(
    `/studio/conversations/${encodeURIComponent(id)}/idle`,
    { method: 'POST', body: '{}' },
  );
}

export function endCall(id: string, reason = 'customer_ended') {
  return api<StudioTurnView>(
    `/studio/conversations/${encodeURIComponent(id)}/end`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export function getSession(id: string) {
  return api<StudioTurnView>(
    `/studio/conversations/${encodeURIComponent(id)}`,
  );
}

export function pendingForms(id: string) {
  return api<{
    formExpose: FormExposeHandle | null;
    liveSays: string[];
    awaitingFormResume: boolean;
  }>(`/studio/conversations/${encodeURIComponent(id)}/forms/pending`);
}

export function ackForm(id: string, exposeId: string) {
  return api(
    `/studio/conversations/${encodeURIComponent(id)}/forms/${encodeURIComponent(exposeId)}/ack`,
    { method: 'POST', body: '{}' },
  );
}

export function submitForm(
  id: string,
  exposeId: string,
  values: Record<string, string>,
) {
  return api<{
    ok: boolean;
    say: string[];
    formExpose: FormExposeHandle | null;
  }>(
    `/studio/conversations/${encodeURIComponent(id)}/forms/${encodeURIComponent(exposeId)}/submit`,
    { method: 'POST', body: JSON.stringify({ values }) },
  );
}

const CALLER_COOKIE = 'studio_caller_id';

export function getOrCreateCallerId(): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CALLER_COOKIE}=([^;]*)`),
  );
  if (match?.[1]) return decodeURIComponent(match[1]);
  const id = crypto.randomUUID();
  document.cookie = `${CALLER_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  return id;
}
