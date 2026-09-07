import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Snapshot = {
  project: { id: string; slug: string | null; name: string | null };
  since: string | null;
  conversations: { total: number; active: number; ended: number };
  outcomes: Array<{
    outcome: string;
    conversations: number;
    ofTotalPct: number | null;
  }>;
  callQuality: {
    durationSampleSize: number;
    p80Sec: number | null;
    p90Sec: number | null;
    askHuman: { conversations: number; ofTotalPct: number | null };
    mad: { conversations: number; ofTotalPct: number | null };
    unknown: { conversations: number; ofTotalPct: number | null };
  };
  funnels: Array<{
    id: string;
    label: string;
    description?: string;
    entryConversations: number;
    steps: Array<{
      id: string;
      label: string;
      conversations: number;
      ofTotalPct: number | null;
      ofEntryPct: number | null;
      ofPrevPct: number | null;
    }>;
  }>;
  topBranches: Array<{
    signature: string;
    branchLabel: string;
    conversations: number;
    ofTotalPct: number | null;
  }>;
  topAnalyticsTags: Array<{
    tag: string;
    conversations: number;
    events: number;
  }>;
  topEventTypes: Array<{
    type: string;
    conversations: number;
    events: number;
  }>;
};

function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function dur(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

export function AnalyticsPage() {
  const [sinceDays, setSinceDays] = useState(30);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const snap = await api<Snapshot>(
        `/analytics/api?sinceDays=${sinceDays}`,
        { headers: { accept: 'application/json' } },
      );
      setData(snap);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [sinceDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = data?.callQuality;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <div className="meta">
            {data?.project?.name || data?.project?.slug || 'Project'} · last{' '}
            {sinceDays} days
          </div>
        </div>
        <div className="toolbar">
          <label className="meta">
            Days{' '}
            <input
              type="number"
              min={1}
              max={365}
              value={sinceDays}
              onChange={(e) => setSinceDays(Number(e.target.value) || 30)}
              style={{ width: 64, marginLeft: 6 }}
            />
          </label>
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
          <a href={`/analytics/export.csv?kind=summary&sinceDays=${sinceDays}`}>
            Export CSV
          </a>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {data ? (
        <>
          <div className="cards">
            <div className="card">
              <div className="meta">Conversations</div>
              <div className="n">{data.conversations.total}</div>
            </div>
            <div className="card">
              <div className="meta">Active</div>
              <div className="n">{data.conversations.active}</div>
            </div>
            <div className="card">
              <div className="meta">Ended</div>
              <div className="n">{data.conversations.ended}</div>
            </div>
          </div>

          {q ? (
            <div className="section-block">
              <h2>Call quality</h2>
              <div className="cards">
                <div className="card">
                  <div className="meta">p80 length</div>
                  <div className="n">{dur(q.p80Sec)}</div>
                  <div className="meta">{q.durationSampleSize} ended</div>
                </div>
                <div className="card">
                  <div className="meta">p90 length</div>
                  <div className="n">{dur(q.p90Sec)}</div>
                </div>
                <div className="card">
                  <div className="meta">Ask human</div>
                  <div className="n">{pct(q.askHuman.ofTotalPct)}</div>
                  <div className="meta">{q.askHuman.conversations} calls</div>
                </div>
                <div className="card">
                  <div className="meta">Mad</div>
                  <div className="n">{pct(q.mad.ofTotalPct)}</div>
                </div>
                <div className="card">
                  <div className="meta">Unknown</div>
                  <div className="n">{pct(q.unknown.ofTotalPct)}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="section-block">
            <h2>Outcomes</h2>
            <div className="cards">
              {data.outcomes.map((o) => (
                <div key={o.outcome} className="card">
                  <div className="meta">{o.outcome}</div>
                  <div className="n">{o.conversations}</div>
                  <div className="meta">{pct(o.ofTotalPct)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-block">
            <h2>Funnels</h2>
            {!data.funnels.length ? (
              <p className="meta">No funnels defined.</p>
            ) : (
              data.funnels.map((f) => (
                <div key={f.id} className="funnel">
                  <strong>{f.label}</strong>
                  {f.description ? (
                    <div className="meta">{f.description}</div>
                  ) : null}
                  <div className="meta" style={{ marginBottom: 8 }}>
                    Entry base: {f.entryConversations}
                  </div>
                  {f.steps.map((s) => (
                    <div key={s.id} className="funnel-step">
                      <span>{s.label}</span>
                      <span className="mono">
                        {s.conversations} · {pct(s.ofEntryPct)} of entry
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="section-block">
            <h2>Top branches</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Calls</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {data.topBranches.map((b) => (
                  <tr key={b.signature}>
                    <td>{b.branchLabel}</td>
                    <td>{b.conversations}</td>
                    <td>{pct(b.ofTotalPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-block">
            <h2>Top tags</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Conversations</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {(data.topAnalyticsTags || []).map((t) => (
                  <tr key={t.tag}>
                    <td className="mono">{t.tag}</td>
                    <td>{t.conversations}</td>
                    <td>{t.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : !error ? (
        <p className="meta">Loading…</p>
      ) : null}
    </div>
  );
}
