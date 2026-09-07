import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate } from '../lib/api';

type ListItem = {
  conversationId: string;
  providerCallId: string;
  status: string;
  callerId: string | null;
  channel: string;
  createdAt: string;
  currentNodeId: string | null;
  chatPreview: string | null;
  vapiCallUrl: string | null;
};

const PAGE_SIZE = 50;

export function ConversationsListPage() {
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<ListItem[]>([]);
  const [status, setStatus] = useState('Loading…');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('Loading…');
    setError('');
    try {
      const body = await api<{ items: ListItem[]; total: number }>(
        `/conversations/api?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setTotal(body.total || 0);
      setItems(body.items || []);
      setStatus('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Conversations</h1>
          <div className="meta">Durable Postgres history</div>
        </div>
        <div className="toolbar">
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>
      <div className={error ? 'error' : 'meta'} style={{ marginBottom: 12, minHeight: '1.2em' }}>
        {error || status}
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>When</th>
            <th>Status</th>
            <th>Channel</th>
            <th>Caller</th>
            <th>Node</th>
            <th>Last user</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {!items.length ? (
            <tr>
              <td colSpan={7} className="meta">
                {status ? 'Loading…' : 'No conversations yet.'}
              </td>
            </tr>
          ) : (
            items.map((row) => (
              <tr key={row.conversationId}>
                <td className="mono">{fmtDate(row.createdAt)}</td>
                <td>
                  <span
                    className={`badge ${row.status === 'ACTIVE' ? 'active' : 'ended'}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td>
                  <span className={`badge ${row.channel}`}>{row.channel}</span>
                </td>
                <td className="mono">{row.callerId || '—'}</td>
                <td className="mono">{row.currentNodeId || '—'}</td>
                <td className="preview" title={row.chatPreview || undefined}>
                  {row.chatPreview || '—'}
                </td>
                <td className="toolbar">
                  <Link to={`/conversations/${row.conversationId}`}>Open</Link>
                  {row.vapiCallUrl ? (
                    <a href={row.vapiCallUrl} target="_blank" rel="noopener noreferrer">
                      Vapi ↗
                    </a>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="toolbar" style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={offset <= 0}
          onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        >
          Newer
        </button>
        <span className="meta">
          {total ? `${from}–${to} of ${total}` : '0 conversations'}
        </span>
        <button
          type="button"
          disabled={offset + PAGE_SIZE >= total}
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
        >
          Older
        </button>
      </div>
    </div>
  );
}
