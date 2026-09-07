import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ackForm,
  endCall,
  getGraph,
  getOrCreateCallerId,
  getPresets,
  getSession,
  idleTurn,
  pendingForms,
  saveEdges,
  sendTurn,
  startCall,
  submitForm,
} from './api';
import { kindColor, layoutGraph } from './layout';
import { StudioNode } from './StudioNode';
import type {
  FlowDiagramNodeData,
  FormExposeHandle,
  StudioPresetsCatalog,
  StudioTurnView,
} from './types';

type ChatLine = { role: 'user' | 'assistant' | 'system'; text: string };

const nodeTypes = { studio: StudioNode };

function minimapNodeColor(node: Node<FlowDiagramNodeData>): string {
  if (node.data?.isCurrent) return '#f4a261';
  return kindColor(node.data?.kind);
}

export function FlowStudioPage() {
  const [presets, setPresets] = useState<StudioPresetsCatalog | null>(null);
  const [afterHours, setAfterHours] = useState(false);
  const [flagOverrides, setFlagOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<
    Node<FlowDiagramNodeData>
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [view, setView] = useState<StudioTurnView | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormExposeHandle | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const idleTimer = useRef<number | null>(null);
  const lastSayAt = useRef(0);
  const ackedForms = useRef(new Set<string>());

  const live = Boolean(conversationId && view && !view.ended);

  const reloadGraph = useCallback(
    async (highlight: string | null, moduleId: string | null) => {
      const graph = await getGraph();
      const laid = layoutGraph(graph, highlight, moduleId);
      setNodes(laid.nodes);
      setEdges(laid.edges);
      setDirty(false);
      return graph;
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [p] = await Promise.all([getPresets(), reloadGraph(null, null)]);
        setPresets(p);
        const flags: Record<string, boolean> = {};
        for (const f of p.featureFlags || []) {
          flags[f.id] = f.defaultEnabled;
        }
        setFlagOverrides(flags);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [reloadGraph]);

  const appendSays = useCallback((says: string[], role: ChatLine['role'] = 'assistant') => {
    const now = Date.now();
    if (role === 'assistant' && now - lastSayAt.current < 250) {
      // soft dedupe burst
    }
    lastSayAt.current = now;
    setChat((prev) => [
      ...prev,
      ...says.filter(Boolean).map((text) => ({ role, text })),
    ]);
  }, []);

  const applyTurn = useCallback(
    async (next: StudioTurnView) => {
      setView(next);
      setConversationId(next.conversationId);
      if (next.say?.length) appendSays(next.say, 'assistant');
      for (const a of next.actions || []) {
        if (a.kind === 'toolCall' && a.toolCall?.name) {
          appendSays([`tool: ${a.toolCall.name}`], 'system');
        }
      }
      const highlight =
        next.diagramHighlightNodeId ||
        next.currentNodeId ||
        next.selectedNodeId ||
        null;
      await reloadGraph(highlight, next.activeModuleId || null);
      if (next.formExpose) setForm(next.formExpose);
      if (next.ended) {
        setBusy(false);
        appendSays(['Call ended.'], 'system');
      }
    },
    [appendSays, reloadGraph],
  );

  const clearIdle = () => {
    if (idleTimer.current) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const armIdle = useCallback(
    (id: string) => {
      clearIdle();
      idleTimer.current = window.setTimeout(() => {
        void (async () => {
          try {
            const next = await idleTurn(id);
            await applyTurn(next);
            if (!next.ended) armIdle(id);
          } catch {
            /* ignore idle errors */
          }
        })();
      }, 30_000);
    },
    [applyTurn],
  );

  useEffect(() => {
    if (!live || !conversationId) return;
    const t = window.setInterval(() => {
      void (async () => {
        try {
          const pending = await pendingForms(conversationId);
          if (pending.liveSays?.length) {
            appendSays(pending.liveSays, 'assistant');
          }
          if (pending.formExpose) {
            setForm(pending.formExpose);
            if (!ackedForms.current.has(pending.formExpose.exposeId)) {
              ackedForms.current.add(pending.formExpose.exposeId);
              await ackForm(conversationId, pending.formExpose.exposeId);
            }
          }
        } catch {
          /* ignore */
        }
      })();
    }, 400);
    return () => window.clearInterval(t);
  }, [appendSays, conversationId, live]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds));
      setDirty(true);
    },
    [setEdges],
  );

  const onCall = async () => {
    setError('');
    setBusy(true);
    setChat([]);
    ackedForms.current.clear();
    try {
      const next = await startCall({
        callerId: getOrCreateCallerId(),
        afterHours,
        featureFlagOverrides: flagOverrides,
      });
      await applyTurn(next);
      if (!next.ended) armIdle(next.conversationId);
      setStatus('Live');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!conversationId || !input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    appendSays([text], 'user');
    setBusy(true);
    clearIdle();
    try {
      const next = await sendTurn(conversationId, text);
      await applyTurn(next);
      if (!next.ended) armIdle(conversationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onHangup = async () => {
    if (!conversationId) return;
    clearIdle();
    setBusy(true);
    try {
      const next = await endCall(conversationId);
      await applyTurn(next);
      setStatus('Ended');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdges = async () => {
    try {
      await saveEdges(
        edges.map((e) => ({
          source: e.source,
          target: e.target,
          label: typeof e.label === 'string' ? e.label : undefined,
        })),
      );
      setDirty(false);
      setStatus('Edges saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSubmitForm = async () => {
    if (!conversationId || !form) return;
    setBusy(true);
    try {
      const res = await submitForm(conversationId, form.exposeId, formValues);
      if (res.say?.length) appendSays(res.say, 'assistant');
      setForm(res.formExpose);
      const refreshed = await getSession(conversationId);
      await applyTurn(refreshed);
      setFormValues({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const highlight = useMemo(
    () =>
      view?.diagramHighlightNodeId ||
      view?.currentNodeId ||
      view?.selectedNodeId ||
      null,
    [view],
  );

  return (
    <div className="page-wide flow-page">
      <div className="flow-toolbar">
        <div>
          <strong>Flow Studio</strong>
          <span className="meta" style={{ marginLeft: 10 }}>
            {view
              ? `${view.workflowId || 'flow'} · ${highlight || '—'}`
              : 'Idle — start a call to drive the graph'}
            {dirty ? ' · unsaved edges' : ''}
          </span>
        </div>
        <div className="toolbar">
          <button type="button" onClick={() => void onSaveEdges()} disabled={!dirty}>
            Save edges
          </button>
          <button
            type="button"
            onClick={() =>
              void reloadGraph(highlight, view?.activeModuleId || null)
            }
          >
            Reload
          </button>
          {!live ? (
            <button type="button" className="btn primary" disabled={busy} onClick={() => void onCall()}>
              Place call
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void onHangup()}>
              Customer hung up
            </button>
          )}
        </div>
      </div>

      <div className="flow-legend" aria-label="Node kinds">
        <span>
          <i className="swatch start-prep" />
          start
        </span>
        <span>
          <i className="swatch start" />
          greeting
        </span>
        <span>
          <i className="swatch normal" />
          node
        </span>
        <span>
          <i className="swatch terminal" />
          terminal
        </span>
        <span>
          <i className="swatch portal" />
          portal
        </span>
        <span>
          <i className="swatch portal-start" />
          portal enter
        </span>
        <span>
          <i className="swatch portal-exit" />
          portal exit
        </span>
        <span>
          <i className="swatch current" />
          current
        </span>
      </div>

      {(error || status) && (
        <div
          className={error ? 'error' : 'meta'}
          style={{ padding: '6px 14px' }}
        >
          {error || status}
        </div>
      )}

      <div className={`flow-body ${live ? '' : 'is-idle'}`}>
        <aside className="flow-side">
          <h3>Presets</h3>
          <div className="flow-side-body">
            {presets ? (
              <>
                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      checked={afterHours}
                      onChange={(e) => setAfterHours(e.target.checked)}
                      disabled={live}
                    />{' '}
                    {presets.afterHours?.label || 'After hours'}
                  </span>
                </label>
                {(presets.featureFlags || []).map((f) => (
                  <label key={f.id} className="field">
                    <span>
                      <input
                        type="checkbox"
                        checked={Boolean(flagOverrides[f.id])}
                        disabled={live}
                        onChange={(e) =>
                          setFlagOverrides((prev) => ({
                            ...prev,
                            [f.id]: e.target.checked,
                          }))
                        }
                      />{' '}
                      {f.label}
                    </span>
                    <span className="meta">{f.description}</span>
                  </label>
                ))}
              </>
            ) : (
              <p className="meta">Loading presets…</p>
            )}
            {view ? (
              <>
                <h3 style={{ marginTop: 16 }}>Session</h3>
                <dl className="summary">
                  <dt>Caller</dt>
                  <dd className="mono">{getOrCreateCallerId().slice(0, 8)}…</dd>
                  <dt>Node</dt>
                  <dd className="mono">{view.currentNodeId || '—'}</dd>
                  <dt>Status</dt>
                  <dd>{view.status}</dd>
                </dl>
                <pre className="json" style={{ maxHeight: 160 }}>
                  {JSON.stringify(view.memory || {}, null, 2)}
                </pre>
              </>
            ) : null}
          </div>
        </aside>

        <div className="flow-canvas-wrap">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              setDirty(true);
            }}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} color="#243040" />
            <Controls />
            <MiniMap
              pannable
              zoomable
              nodeColor={minimapNodeColor}
              maskColor="rgba(15,20,25,0.72)"
              bgColor="#121820"
              style={{ width: 120, height: 80 }}
            />
          </ReactFlow>
        </div>

        {live ? (
          <aside className="flow-chat">
            <h3>Chat</h3>
            <div className="chat-log" style={{ flex: 1, maxHeight: 'none' }}>
              {chat.map((line, i) => (
                <div key={i} className={`chat-row ${line.role}`}>
                  <div>
                    <div className="role">{line.role}</div>
                    <div className="bubble">{line.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="composer">
              <textarea
                rows={2}
                value={input}
                disabled={busy || Boolean(form)}
                placeholder="Caller reply…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
              />
              <div className="composer-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || !input.trim() || Boolean(form)}
                  onClick={() => void onSend()}
                >
                  Send
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {form ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Form</h2>
            {form.fields.map((f) => (
              <label key={f.name} className="field">
                {f.label}
                {f.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={formValues[f.name] || ''}
                    onChange={(e) =>
                      setFormValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
                    value={formValues[f.name] || ''}
                    placeholder={f.placeholder}
                    required={f.required}
                    onChange={(e) =>
                      setFormValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                  />
                )}
              </label>
            ))}
            <div className="toolbar">
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => void onSubmitForm()}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
