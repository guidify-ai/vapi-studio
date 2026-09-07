import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate } from '../lib/api';

type Detail = {
  conversationId: string;
  providerCallId: string;
  status: string;
  callerId: string | null;
  channel: string;
  createdAt: string;
  endedAt: string | null;
  lastActivityAt: string | null;
  currentNodeId: string | null;
  activeModuleId: string | null;
  brainProfileId: string | null;
  liveInMemory: boolean;
  vapiCallUrl: string | null;
  history: {
    chat?: Array<{ role: string; text?: string }>;
    nodes?: Array<{
      turnNumber: number;
      nodeId: string;
      intention?: string;
      at: string;
    }>;
  };
  memory: Record<string, unknown>;
  events: Array<{
    id: string;
    type: string;
    createdAt: string;
    payload: Record<string, unknown>;
  }>;
};

export function ConversationDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing conversation id in URL.');
      return;
    }
    setError('');
    try {
      const d = await api<Detail>(`/conversations/api/${encodeURIComponent(id)}`);
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const chat = data?.history?.chat || [];
  const nodes = data?.history?.nodes || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>
            {data
              ? `Conversation ${data.conversationId.slice(0, 8)}…`
              : 'Conversation'}
          </h1>
          <div className="meta">
            {data
              ? `${data.liveInMemory ? 'LIVE in memory · ' : ''}${data.status} · ${data.channel}${
                  data.currentNodeId ? ` · node ${data.currentNodeId}` : ''
                }`
              : 'Loading…'}
          </div>
        </div>
        <div className="toolbar">
          <Link to="/conversations">← All conversations</Link>
          {data?.vapiCallUrl ? (
            <a
              className="btn"
              href={data.vapiCallUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Vapi ↗
            </a>
          ) : null}
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {data ? (
        <div className="detail-grid">
          <section className="panel">
            <h2>Chat history</h2>
            <div className="chat-log">
              {!chat.length ? (
                <p className="meta">No chat messages in snapshot.</p>
              ) : (
                chat
                  .filter((m) => m.role === 'user' || m.role === 'assistant')
                  .map((m, i) => (
                    <div key={i} className={`chat-row ${m.role}`}>
                      <div>
                        <div className="role">{m.role}</div>
                        <div className="bubble">{m.text || ''}</div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </section>
          <aside className="side">
            <section className="panel">
              <h2>Summary</h2>
              <dl className="summary">
                <dt>ID</dt>
                <dd className="mono">{data.conversationId}</dd>
                <dt>Provider call</dt>
                <dd className="mono">{data.providerCallId}</dd>
                <dt>Caller</dt>
                <dd className="mono">{data.callerId || '—'}</dd>
                <dt>Created</dt>
                <dd className="mono">{fmtDate(data.createdAt)}</dd>
                <dt>Ended</dt>
                <dd className="mono">{fmtDate(data.endedAt)}</dd>
                <dt>Last activity</dt>
                <dd className="mono">{fmtDate(data.lastActivityAt)}</dd>
                <dt>Current node</dt>
                <dd className="mono">{data.currentNodeId || '—'}</dd>
                <dt>Module</dt>
                <dd className="mono">{data.activeModuleId || '—'}</dd>
                <dt>Brain</dt>
                <dd className="mono">{data.brainProfileId || '—'}</dd>
              </dl>
            </section>
            <section className="panel">
              <h2>Node path</h2>
              <pre className="json">
                {nodes.length
                  ? nodes
                      .map(
                        (n) =>
                          `${n.turnNumber} ${n.nodeId} ← ${n.intention || '?'} @ ${n.at}`,
                      )
                      .join('\n')
                  : '(empty)'}
              </pre>
            </section>
            <section className="panel">
              <h2>Memory</h2>
              <pre className="json">{JSON.stringify(data.memory || {}, null, 2)}</pre>
            </section>
            <section className="panel">
              <h2>
                Events <span className="meta">({data.events?.length || 0})</span>
              </h2>
              <div className="events">
                {!data.events?.length ? (
                  <p className="meta" style={{ padding: 12 }}>
                    No events.
                  </p>
                ) : (
                  data.events.map((ev) => (
                    <div key={ev.id} className="event">
                      <div className="event-type">{ev.type}</div>
                      <div className="meta">{fmtDate(ev.createdAt)}</div>
                      <pre className="json">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
