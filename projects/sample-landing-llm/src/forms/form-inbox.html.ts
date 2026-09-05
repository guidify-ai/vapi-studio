/**
 * Operator inbox: list every exposed-but-not-submitted form.
 * Click Open → fill HTML → Submit → FormsService.submit (bot resumes).
 */
export function renderFormInboxHtml(options?: { pollMs?: number }): string {
  const pollMs = Math.max(400, options?.pollMs ?? 800);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pending forms</title>
  <style>
    :root { color-scheme: light; --ink:#14213d; --muted:#5c6b7a; --line:#d7dde5; --bg:#f4f6f8; --accent:#1b6ef3; --card:#fff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:var(--bg); color:var(--ink); }
    main { max-width: 40rem; margin: 0 auto; padding: 1.75rem 1.25rem 3rem; }
    h1 { font-size: 1.4rem; margin: 0 0 0.35rem; }
    .sub { color: var(--muted); margin: 0 0 1.25rem; line-height: 1.45; }
    .bar { display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; color:var(--muted); font-size:0.9rem; }
    .pulse { width:0.5rem; height:0.5rem; border-radius:999px; background:var(--accent); animation: blink 1.2s ease-in-out infinite; }
    @keyframes blink { 50% { opacity: 0.25; } }
    ul { list-style:none; margin:0; padding:0; display:grid; gap:0.75rem; }
    li { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:0.95rem 1rem; display:flex; gap:0.85rem; align-items:flex-start; justify-content:space-between; }
    .meta { min-width:0; }
    .title { font-weight:650; margin:0 0 0.25rem; }
    .detail { color:var(--muted); font-size:0.85rem; line-height:1.4; word-break:break-all; }
    a.btn { flex-shrink:0; text-decoration:none; font-weight:650; font-size:0.9rem; color:#fff; background:var(--accent); border-radius:999px; padding:0.55rem 0.95rem; }
    a.btn:hover { filter: brightness(0.96); }
    .empty { background:var(--card); border:1px dashed var(--line); border-radius:12px; padding:1.25rem; color:var(--muted); }
    code { background:#fff; border:1px solid var(--line); border-radius:6px; padding:0.05rem 0.3rem; font-size:0.85em; }
  </style>
</head>
<body>
  <main>
    <h1>Pending forms</h1>
    <p class="sub">Exposed forms waiting for submit. Open one, fill it on this Mac, and submit — the bot treats it as the caller and continues the call.</p>
    <div class="bar"><span class="pulse"></span><span id="status">Refreshing…</span></div>
    <div id="list" class="empty">No open forms yet. Place a call — when the bot exposes the identity form, it will appear here.</div>
  </main>
  <script>
    (function () {
      var listEl = document.getElementById('list');
      var statusEl = document.getElementById('status');
      function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }
      function render(items) {
        if (!items || !items.length) {
          listEl.className = 'empty';
          listEl.textContent = 'No open forms yet. Place a call — when the bot exposes the identity form, it will appear here.';
          statusEl.textContent = 'Waiting for exposes…';
          return;
        }
        statusEl.textContent = items.length + ' waiting — click Open to fill';
        listEl.className = '';
        listEl.innerHTML = '<ul>' + items.map(function (row) {
          var title = esc(row.title || ('Form ' + row.formId));
          var shortId = esc(String(row.exposeId).slice(0, 8));
          var conv = esc(String(row.conversationId || '').slice(0, 8));
          var when = esc(row.createdAt || '');
          var fields = (row.fieldNames || []).map(esc).join(', ');
          var branch = row.branch ? esc(row.branch) : '';
          var via = row.deliveryBranch ? esc(row.deliveryBranch) : '';
          var href = '/forms/' + encodeURIComponent(row.exposeId);
          return '<li><div class="meta"><p class="title">' + title + '</p>' +
            '<p class="detail">expose <code>' + shortId + '…</code> · conversation <code>' + conv + '…</code><br/>' +
            when +
            (branch || via ? '<br/>branch <code>' + branch + '</code>' + (via ? ' via <code>' + via + '</code>' : '') : '') +
            (fields ? '<br/>fields: ' + fields : '') + '</p></div>' +
            '<a class="btn" href="' + href + '">Open</a></li>';
        }).join('') + '</ul>';
      }
      function tick() {
        fetch('/forms/pending', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (data) { render(data.items || []); })
          .catch(function () {
            statusEl.textContent = 'Inbox offline — is the app up on :9999?';
          });
      }
      tick();
      setInterval(tick, ${pollMs});
    })();
  </script>
</body>
</html>`;
}
