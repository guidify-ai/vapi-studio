import type { SampleAnalyticsSnapshot } from './analytics.service';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderSampleAnalyticsPage(
  snap: SampleAnalyticsSnapshot,
): string {
  const cards = [
    ['Total', snap.conversations.total],
    ['Active', snap.conversations.active],
    ['Completed', snap.conversations.completed],
    ['Quoted', snap.conversations.quoted],
    ['Drafts w/ funnels', snap.drafts.withFunnels],
    ['Drafts w/ sample', snap.drafts.withSample],
  ]
    .map(
      ([label, n]) =>
        `<div class="card"><div class="meta">${esc(label)}</div><div class="n">${n}</div></div>`,
    )
    .join('');

  const reasons = snap.completedReasons
    .map(
      (r) =>
        `<tr><td>${esc(r.reason)}</td><td>${r.count}</td><td>${r.ofTotalPct}%</td></tr>`,
    )
    .join('');

  const useCases = snap.topUseCases
    .map(
      (u) =>
        `<tr><td>${esc(u.useCase)}</td><td>${u.count}</td></tr>`,
    )
    .join('');

  const companies = snap.topCompanies
    .map(
      (c) =>
        `<tr><td>${esc(c.company)}</td><td>${c.count}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(snap.project.name)} — analytics</title>
  <style>
    :root { --bg:#0f1419; --panel:#1a222c; --text:#e7eef7; --muted:#8b9aab; --accent:#5b9fd4; }
    body { margin:0; font:15px/1.45 system-ui,sans-serif; background:var(--bg); color:var(--text); }
    main { max-width:960px; margin:0 auto; padding:2rem 1.25rem 4rem; }
    h1 { font-size:1.5rem; margin:0 0 .25rem; }
    .sub { color:var(--muted); margin-bottom:1.5rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:.75rem; margin-bottom:2rem; }
    .card { background:var(--panel); border-radius:10px; padding:1rem; }
    .card .meta { color:var(--muted); font-size:.8rem; }
    .card .n { font-size:1.6rem; font-weight:650; margin-top:.2rem; }
    h2 { font-size:1.1rem; margin:1.75rem 0 .6rem; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border-radius:10px; overflow:hidden; }
    th, td { text-align:left; padding:.55rem .75rem; border-bottom:1px solid #2a3441; }
    th { color:var(--muted); font-weight:600; font-size:.8rem; }
    a { color:var(--accent); }
  </style>
</head>
<body>
<main>
  <h1>${esc(snap.project.name)}</h1>
  <p class="sub">Last ${snap.sinceDays} days · port ${snap.project.port} ·
    <a href="/analytics/api?sinceDays=${snap.sinceDays}">JSON</a> ·
    <a href="/">planner UI</a>
  </p>
  <div class="grid">${cards}</div>
  <h2>Close reasons</h2>
  <table><thead><tr><th>Reason</th><th>Count</th><th>% of total</th></tr></thead><tbody>${reasons || '<tr><td colspan="3">No data yet</td></tr>'}</tbody></table>
  <h2>Top use cases / brands</h2>
  <table><thead><tr><th>Use case</th><th>Count</th></tr></thead><tbody>${useCases || '<tr><td colspan="2">No data yet</td></tr>'}</tbody></table>
  <h2>Top companies</h2>
  <table><thead><tr><th>Company</th><th>Count</th></tr></thead><tbody>${companies || '<tr><td colspan="2">No data yet</td></tr>'}</tbody></table>
</main>
</body>
</html>`;
}
