"use strict";
/**
 * First-party HTML form renderer — builds a simple page from FormFieldSpec JSON.
 * Apps serve this from GET /forms/:exposeId; submit posts back to FormsService.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderFormHtml = renderFormHtml;
exports.renderFormThanksHtml = renderFormThanksHtml;
exports.renderFormGoneHtml = renderFormGoneHtml;
function escapeHtml(raw) {
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function inputType(field) {
    switch (field.type) {
        case 'email':
            return 'email';
        case 'tel':
            return 'tel';
        default:
            return 'text';
    }
}
function renderField(field) {
    const req = field.required ? ' required' : '';
    const ph = field.placeholder
        ? ` placeholder="${escapeHtml(field.placeholder)}"`
        : '';
    const name = escapeHtml(field.name);
    const label = escapeHtml(field.label);
    if (field.type === 'textarea') {
        return `<label class="field"><span>${label}</span><textarea name="${name}" rows="3"${req}${ph}></textarea></label>`;
    }
    return `<label class="field"><span>${label}</span><input type="${inputType(field)}" name="${name}" autocomplete="on"${req}${ph} /></label>`;
}
/**
 * Render a complete HTML document for a pending form expose.
 * Field definitions come from the expose handle (JSON → HTML).
 */
function renderFormHtml(handle, options = {}) {
    const action = escapeHtml(options.action ?? `/forms/${handle.exposeId}`);
    const title = escapeHtml(options.title ?? 'Your details');
    const subtitle = escapeHtml(options.subtitle ?? 'Fill this out and submit — we are waiting on the line.');
    const submitLabel = escapeHtml(options.submitLabel ?? 'Submit');
    const error = options.error
        ? `<p class="error" role="alert">${escapeHtml(options.error)}</p>`
        : '';
    const fields = handle.fields.map(renderField).join('\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light; --ink: #14213d; --muted: #5c6b7a; --line: #d7dde5; --accent: #1b6ef3; --bg: #f4f6f8; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--ink); }
    main { max-width: 28rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
    h1 { font-size: 1.35rem; margin: 0 0 0.35rem; }
    .sub { color: var(--muted); margin: 0 0 1.25rem; line-height: 1.4; font-size: 0.95rem; }
    form { display: grid; gap: 0.9rem; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 1.1rem; }
    .field { display: grid; gap: 0.35rem; font-size: 0.9rem; }
    .field span { font-weight: 600; }
    input, textarea { width: 100%; font: inherit; padding: 0.65rem 0.7rem; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    input:focus, textarea:focus { outline: 2px solid color-mix(in srgb, var(--accent) 45%, white); border-color: var(--accent); }
    button { font: inherit; font-weight: 600; border: 0; border-radius: 999px; padding: 0.75rem 1rem; background: var(--accent); color: #fff; cursor: pointer; }
    button:hover { filter: brightness(0.96); }
    .error { background: #fde8e8; color: #8a1f1f; border-radius: 8px; padding: 0.65rem 0.75rem; margin: 0 0 0.75rem; }
    .meta { margin-top: 1rem; color: var(--muted); font-size: 0.75rem; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p class="sub">${subtitle}</p>
    ${error}
    <form method="post" action="${action}" novalidate>
      ${fields}
      <button type="submit">${submitLabel}</button>
    </form>
    <p class="meta">Form ${handle.formId} · ${escapeHtml(handle.exposeId.slice(0, 8))}…</p>
  </main>
</body>
</html>`;
}
/** Thank-you page after successful submit. */
function renderFormThanksHtml(options) {
    const title = escapeHtml(options?.title ?? 'Thanks');
    const body = escapeHtml(options?.body ??
        'We received your details. You can return to the call — we are still on the line.');
    const back = options?.backHref != null
        ? `<p><a href="${escapeHtml(options.backHref)}">${escapeHtml(options.backLabel ?? 'Back')}</a></p>`
        : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #f4f6f8; color: #14213d; }
    main { max-width: 28rem; margin: 0 auto; padding: 2rem 1.25rem; }
    h1 { font-size: 1.35rem; margin: 0 0 0.5rem; }
    p { color: #5c6b7a; line-height: 1.45; }
    a { color: #1b6ef3; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
    ${back}
  </main>
</body>
</html>`;
}
/** Simple not-found / expired page. */
function renderFormGoneHtml(message) {
    const body = escapeHtml(message ?? 'This form link is missing or has already been completed.');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Form unavailable</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:2rem;color:#14213d;background:#f4f6f8}p{color:#5c6b7a}</style>
</head><body><h1>Form unavailable</h1><p>${body}</p></body></html>`;
}
//# sourceMappingURL=form-html.js.map