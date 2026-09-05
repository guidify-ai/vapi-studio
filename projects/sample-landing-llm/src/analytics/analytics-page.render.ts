import type { ProjectAnalyticsSnapshot } from './analytics.service';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function renderSummaryCards(c: ProjectAnalyticsSnapshot['conversations']): string {
  const items = [
    ['Conversations', c.total],
    ['Active', c.active],
    ['Ended', c.ended],
  ] as const;
  return items
    .map(
      ([label, n]) =>
        `<div class="card"><div class="meta">${esc(label)}</div><div class="n">${n}</div></div>`,
    )
    .join('');
}

function fmtDurationSec(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

function renderCallQuality(q: ProjectAnalyticsSnapshot['callQuality']): string {
  const cards = [
    {
      label: 'p80 length',
      n: fmtDurationSec(q.p80Sec),
      meta: `${q.durationSampleSize} ended calls`,
    },
    {
      label: 'p90 length',
      n: fmtDurationSec(q.p90Sec),
      meta: `${q.durationSampleSize} ended calls`,
    },
    {
      label: 'Ask human',
      n: fmtPct(q.askHuman.ofTotalPct),
      meta: `${q.askHuman.conversations} calls`,
    },
    {
      label: 'Mad',
      n: fmtPct(q.mad.ofTotalPct),
      meta: `${q.mad.conversations} calls`,
    },
    {
      label: 'Unknown',
      n: fmtPct(q.unknown.ofTotalPct),
      meta: `${q.unknown.conversations} calls`,
    },
  ];
  return cards
    .map(
      (c) =>
        `<div class="card quality">` +
        `<div class="meta">${esc(c.label)}</div>` +
        `<div class="n">${esc(c.n)}</div>` +
        `<div class="meta">${esc(c.meta)}</div>` +
        `</div>`,
    )
    .join('');
}

function renderOutcomeCards(
  outcomes: ProjectAnalyticsSnapshot['outcomes'],
): string {
  const tone: Record<string, string> = {
    success: 'outcome-success',
    failure: 'outcome-failure',
    unknown: 'outcome-unknown',
  };
  return outcomes
    .map(
      (o) =>
        `<div class="card outcome ${tone[o.outcome] ?? ''}">` +
        `<div class="meta">${esc(o.outcome)}</div>` +
        `<div class="n">${o.conversations}</div>` +
        `<div class="meta">${fmtPct(o.ofTotalPct)} of calls</div>` +
        `</div>`,
    )
    .join('');
}

/**
 * Readable funnel: full-width step rows + meter for volume.
 * Text never shrinks with conversion % (classic trapezoids clip late steps).
 */
function renderFunnel(f: ProjectAnalyticsSnapshot['funnels'][0]): string {
  const entry = Math.max(1, f.entryConversations ?? 0);
  const last = f.steps[f.steps.length - 1];
  const completion =
    entry > 0 && last
      ? Math.round((last.conversations / entry) * 1000) / 10
      : null;

  const steps = f.steps
    .map((s, i) => {
      const pctOfCalls =
        s.ofEntryPct != null
          ? s.ofEntryPct
          : Math.round((s.conversations / entry) * 1000) / 10;
      const barW = Math.max(0, Math.min(100, pctOfCalls));
      const prev = i > 0 ? f.steps[i - 1] : null;
      const dropPct =
        prev && s.ofPrevPct != null && s.ofPrevPct < 100
          ? Math.round(100 - s.ofPrevPct)
          : null;
      const keepPct =
        prev && s.ofPrevPct != null ? fmtPct(s.ofPrevPct) : null;

      const connector =
        i === 0
          ? ''
          : dropPct != null
            ? `<div class="funnel-connector drop" aria-hidden="true">` +
              `<span class="funnel-connector-line"></span>` +
              `<span class="funnel-connector-chip">−${dropPct}% from previous</span>` +
              `<span class="funnel-connector-line"></span>` +
              `</div>`
            : `<div class="funnel-connector keep" aria-hidden="true">` +
              `<span class="funnel-connector-line"></span>` +
              `<span class="funnel-connector-chip muted">held</span>` +
              `<span class="funnel-connector-line"></span>` +
              `</div>`;

      return (
        connector +
        `<div class="funnel-step" data-step="${esc(s.id)}">` +
        `<div class="funnel-step-top">` +
        `<div class="funnel-step-title">` +
        `<span class="funnel-step-idx">${i + 1}</span>` +
        `<span class="funnel-step-label">${esc(s.label)}</span>` +
        `</div>` +
        `<div class="funnel-step-metrics">` +
        `<div class="funnel-metric">` +
        `<span class="funnel-metric-n">${s.conversations}</span>` +
        `<span class="funnel-metric-k">calls</span>` +
        `</div>` +
        `<div class="funnel-metric">` +
        `<span class="funnel-metric-n">${fmtPct(s.ofEntryPct)}</span>` +
        `<span class="funnel-metric-k">of calls</span>` +
        `</div>` +
        (keepPct
          ? `<div class="funnel-metric">` +
            `<span class="funnel-metric-n">${keepPct}</span>` +
            `<span class="funnel-metric-k">of prev</span>` +
            `</div>`
          : '') +
        `</div>` +
        `</div>` +
        `<div class="funnel-meter" title="${esc(s.label)}: ${pctOfCalls}% of all calls" role="presentation">` +
        `<div class="funnel-meter-track">` +
        `<div class="funnel-meter-fill" style="width:${barW}%"></div>` +
        `</div>` +
        `</div>` +
        `</div>`
      );
    })
    .join('');

  return (
    `<article class="funnel-card" data-funnel="${esc(f.id)}">` +
    `<div class="funnel-card-head">` +
    `<div class="funnel-card-copy">` +
    `<h2>${esc(f.label)}</h2>` +
    `<div class="funnel-id mono">${esc(f.id)}</div>` +
    (f.description ? `<p class="desc">${esc(f.description)}</p>` : '') +
    `</div>` +
    `<div class="funnel-completion" aria-label="Funnel completion">` +
    `<span class="funnel-completion-label">Completion</span>` +
    `<span class="funnel-completion-n">${fmtPct(completion)}</span>` +
    `<span class="funnel-completion-sub">${last?.conversations ?? 0} of ${f.entryConversations} calls</span>` +
    `</div>` +
    `</div>` +
    `<div class="funnel-steps" role="list" aria-label="${esc(f.label)} funnel steps">` +
    steps +
    `</div>` +
    `</article>`
  );
}

function renderTopTable(
  title: string,
  rows: Array<{ conversations: number; events: number } & Record<string, unknown>>,
  keyName: string,
): string {
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `<tr>` +
            `<td class="mono">${esc(r[keyName])}</td>` +
            `<td>${r.conversations}</td>` +
            `<td>${r.events}</td>` +
            `</tr>`,
        )
        .join('')
    : `<tr><td colspan="3" class="meta">None yet — run calls to populate tags.</td></tr>`;
  return (
    `<section class="section">` +
    `<h2>${esc(title)}</h2>` +
    `<table><thead><tr><th>Tag / type</th><th>Conversations</th><th>Events</th></tr></thead>` +
    `<tbody>${body}</tbody></table>` +
    `</section>`
  );
}

export function renderAnalyticsBody(
  data: ProjectAnalyticsSnapshot,
  sinceDays: number,
): string {
  const name = data.project.name || data.project.slug || 'Project';
  const sinceLabel = data.since
    ? new Date(data.since).toLocaleDateString()
    : '';
  return (
    `<header class="page-nav">` +
    `<div>` +
    `<h1>Analytics</h1>` +
    `<div class="meta">${esc(name)} · ${esc(data.project.id)}${sinceLabel ? ` · since ${esc(sinceLabel)}` : ''}</div>` +
    `</div>` +
    `<div class="toolbar">` +
    `<form method="get" action="/analytics" class="range-form">` +
    `<label class="meta" for="sinceDays">Range</label>` +
    `<select name="sinceDays" id="sinceDays" onchange="this.form.submit()">` +
    [7, 30, 90, 365]
      .map(
        (d) =>
          `<option value="${d}"${d === sinceDays ? ' selected' : ''}>${d} days</option>`,
      )
      .join('') +
    `</select>` +
    `</form>` +
    `<details class="export-menu">` +
    `<summary>Export CSV</summary>` +
    `<div class="export-menu-panel">` +
    `<a href="/analytics/export.csv?kind=quality&sinceDays=${sinceDays}">Call quality</a>` +
    `<a href="/analytics/export.csv?kind=funnels&sinceDays=${sinceDays}">Funnels</a>` +
    `<a href="/analytics/export.csv?kind=outcomes&sinceDays=${sinceDays}">Outcomes</a>` +
    `<a href="/analytics/export.csv?kind=tags&sinceDays=${sinceDays}">Tags</a>` +
    `<a href="/analytics/export.csv?kind=events&sinceDays=${sinceDays}">Event types</a>` +
    `<a href="/analytics/export.csv?kind=branches&sinceDays=${sinceDays}">Top paths</a>` +
    `<a href="/analytics/export.csv?kind=summary&sinceDays=${sinceDays}">Summary</a>` +
    `</div>` +
    `</details>` +
    `<a href="/conversations">Conversations</a>` +
    `<a href="/flow">Flow Studio</a>` +
    `<a href="/analytics/api?sinceDays=${sinceDays}" class="api-link">JSON API</a>` +
    `</div>` +
    `</header>` +
    `<main class="analytics-shell">` +
    `<div class="cards">${renderSummaryCards(data.conversations)}</div>` +
    `<section class="section"><h2>Call quality</h2>` +
    `<p class="desc">Length percentiles from ended calls (<code>ended_at − created_at</code>). Ratios of all calls: ask-human (<code>TRANSFER_REENGAGE</code> / transferred end), mad (<code>MAD_ENTER</code>), unknown (<code>UNKNOWN_TRANSITION</code>).</p>` +
    `<div class="cards quality-grid">${renderCallQuality(data.callQuality)}</div></section>` +
    `<section class="section"><h2>Call outcomes</h2>` +
    `<p class="desc">LLM triage on every ended call — <code>success</code>, <code>failure</code>, or <code>unknown</code>.</p>` +
    `<div class="cards outcomes">${renderOutcomeCards(data.outcomes)}</div></section>` +
    `<section class="funnels-block">` +
    `<div class="funnels-intro">` +
    `<h2>Business funnels</h2>` +
    `<p class="desc">Three product outcomes: <strong>appointment only</strong>, <strong>estimate only</strong>, or <strong>both</strong>. Call start is omitted from steps (every call hits it); percentages are still of <strong>all calls</strong> in range so identity can be under 100%.</p>` +
    `</div>` +
    `<div class="funnel-grid">` +
    data.funnels.map((f) => renderFunnel(f)).join('') +
    `</div>` +
    `</section>` +
    `<div class="grid2">` +
    renderTopTable('Top ANALYTICS_TAG (all)', data.topAnalyticsTags, 'tag') +
    renderTopTable('Top event types', data.topEventTypes, 'type') +
    `</div>` +
    `<p class="meta footer-note">Outcomes from <code>CALL_OUTCOME</code>. Funnel charts score catalog step tags (and optional historical event-type bindings).</p>` +
    `</main>`
  );
}

export function renderAnalyticsPage(
  data: ProjectAnalyticsSnapshot,
  sinceDays: number,
): string {
  const name = data.project.name || data.project.slug || 'Project';
  const body = renderAnalyticsBody(data, sinceDays);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Analytics — ${esc(name)}</title>
  <style>
    :root {
      --bg: #0c1016;
      --panel: #151c26;
      --ink: #e8eef5;
      --muted: #8b9aab;
      --border: #2a3542;
      --accent: #e9c46a;
      --link: #5eead4;
      --bar: #2a9d8f;
      --drop: #e76f51;
      --funnel-top: #1a6b63;
      --funnel-mid: #2a9d8f;
      --funnel-bot: #3dbaa8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(1200px 600px at 10% -10%, #1a2838 0%, transparent 55%),
        radial-gradient(900px 500px at 90% 0%, #1c2430 0%, transparent 50%),
        var(--bg);
      color: var(--ink);
      font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
      font-size: 0.9rem;
    }
    header.page-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: rgba(21, 28, 38, 0.96);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(8px);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    h1 { margin: 0; font-size: 1.1rem; }
    h2 { margin: 0 0 6px; font-size: 1rem; }
    a { color: var(--link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .api-link { color: var(--muted); font-size: 0.78rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .range-form { display: flex; gap: 8px; align-items: center; margin: 0; }
    .export-menu {
      position: relative;
      color: var(--link);
      font-size: 0.9rem;
    }
    .export-menu > summary {
      cursor: pointer;
      list-style: none;
      user-select: none;
    }
    .export-menu > summary::-webkit-details-marker { display: none; }
    .export-menu > summary::after { content: " ▾"; opacity: 0.7; }
    .export-menu-panel {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      min-width: 160px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      background: #151c26;
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: 0 12px 28px rgba(0,0,0,0.35);
      z-index: 120;
    }
    .export-menu-panel a {
      display: block;
      padding: 7px 10px;
      border-radius: 6px;
      color: var(--ink);
      text-decoration: none;
      font-size: 0.84rem;
    }
    .export-menu-panel a:hover {
      background: #243040;
      text-decoration: none;
    }
    select {
      background: #243040;
      border: 1px solid var(--border);
      color: var(--ink);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 0.8rem;
    }
    main.analytics-shell {
      width: 92%;
      max-width: 1280px;
      margin: 0 auto;
      padding: 20px 0 56px;
    }
    .meta { color: var(--muted); font-size: 0.8rem; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin: 0 0 24px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .card .n {
      font-size: 1.6rem;
      font-weight: 650;
      letter-spacing: -0.02em;
      color: var(--accent);
    }
    .outcomes { margin-top: 8px; }
    .quality-grid { margin-top: 8px; }
    .card.quality .n { font-size: 1.35rem; color: var(--link); }
    .outcome-success .n { color: #6ee7b7; }
    .outcome-failure .n { color: #fca5a5; }
    .outcome-unknown .n { color: var(--muted); }
    code { font-family: ui-monospace, monospace; font-size: 0.78rem; }
    .section {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 16px;
    }
    .funnels-block { margin: 8px 0 28px; }
    .funnels-intro { margin-bottom: 16px; }
    .funnel-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    @media (min-width: 1100px) {
      .funnel-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: start;
      }
    }
    .funnel-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px 18px 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.22);
      min-width: 0;
    }
    .funnel-card-head {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }
    .funnel-card-copy { min-width: 0; }
    .funnel-card-copy h2 {
      font-size: 1.05rem;
      line-height: 1.25;
      margin: 0 0 4px;
    }
    .funnel-id { color: var(--muted); font-size: 0.72rem; margin-bottom: 8px; }
    .funnel-card-copy .desc {
      margin: 0;
      font-size: 0.78rem;
      line-height: 1.45;
    }
    .funnel-completion {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #101820;
      border: 1px solid var(--border);
    }
    .funnel-completion-label {
      color: var(--muted);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
    }
    .funnel-completion-n {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .funnel-completion-sub {
      color: var(--muted);
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
      margin-left: auto;
    }
    .funnel-steps {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .funnel-step {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(16, 24, 32, 0.55);
      border: 1px solid rgba(42, 53, 66, 0.9);
    }
    .funnel-step-top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px 14px;
    }
    .funnel-step-title {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-width: 0;
      flex: 1 1 140px;
    }
    .funnel-step-idx {
      flex-shrink: 0;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.72rem;
      font-weight: 700;
      color: #0c1016;
      background: var(--funnel-mid);
      margin-top: 1px;
    }
    .funnel-step-label {
      font-size: 0.92rem;
      font-weight: 600;
      line-height: 1.35;
      color: var(--ink);
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .funnel-step-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      flex-shrink: 0;
    }
    .funnel-metric {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 3.4rem;
      line-height: 1.15;
    }
    .funnel-metric-n {
      font-variant-numeric: tabular-nums;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ink);
    }
    .funnel-metric-k {
      font-size: 0.68rem;
      color: var(--muted);
      text-transform: lowercase;
      letter-spacing: 0.02em;
    }
    .funnel-meter { width: 100%; }
    .funnel-meter-track {
      height: 8px;
      border-radius: 999px;
      background: #0a1018;
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .funnel-meter-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--funnel-top), var(--funnel-mid) 55%, var(--funnel-bot));
      min-width: 0;
      transition: width 0.35s ease;
    }
    .funnel-connector {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 8px;
      margin: 6px 4px;
      min-height: 1.4rem;
    }
    .funnel-connector-line {
      height: 1px;
      background: var(--border);
    }
    .funnel-connector-chip {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
      color: #fecaca;
      background: rgba(231, 111, 81, 0.16);
      border: 1px solid rgba(231, 111, 81, 0.35);
    }
    .funnel-connector-chip.muted {
      color: var(--muted);
      background: rgba(139, 154, 171, 0.1);
      border-color: var(--border);
      font-weight: 500;
    }
    .desc { color: var(--muted); font-size: 0.8rem; margin: 0 0 8px; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
      font-size: 0.82rem;
    }
    th {
      color: var(--muted);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .mono { font-family: ui-monospace, monospace; font-size: 0.78rem; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .footer-note { margin-top: 20px; }
    @media (max-width: 860px) {
      main.analytics-shell { width: 96%; }
      .grid2 { grid-template-columns: 1fr; }
      .funnel-completion-sub { margin-left: 0; width: 100%; }
      .funnel-metric { align-items: flex-start; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}
