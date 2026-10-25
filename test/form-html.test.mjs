/**
 * form-html renderer — FormFieldSpec JSON → HTML document.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  renderFormGoneHtml,
  renderFormHtml,
  renderFormThanksHtml,
} from '../dist/forms/form-html.js';

describe('renderFormHtml', () => {
  it('builds inputs from field JSON including textarea and email', () => {
    const html = renderFormHtml(
      {
        exposeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        formId: 1,
        fields: [
          { name: 'firstName', label: 'First name', type: 'string', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          {
            name: 'address',
            label: 'Property address',
            type: 'textarea',
            required: true,
            placeholder: 'Street',
          },
        ],
      },
      { title: 'Your details' },
    );
    // Default action is "" so POST stays on the UUID-prefixed public URL
    // (ngrok-helper / multi-tenant hosts) instead of absolute `/forms/...`.
    assert.match(html, /<form method="post" action="" novalidate>/);
    assert.match(html, /name="firstName"/);
    assert.match(html, /type="email"/);
    assert.match(html, /<textarea name="address"/);
    assert.match(html, /placeholder="Street"/);
    assert.match(html, /Your details/);
  });

  it('honors an explicit action path when provided', () => {
    const html = renderFormHtml(
      {
        exposeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        formId: 1,
        fields: [{ name: 'n', label: 'N', type: 'string' }],
      },
      { action: '/forms/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    );
    assert.match(
      html,
      /<form method="post" action="\/forms\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"/,
    );
  });

  it('escapes untrusted labels', () => {
    const html = renderFormHtml({
      exposeId: 'x',
      formId: 1,
      fields: [
        {
          name: 'n',
          label: '<script>alert(1)</script>',
          type: 'string',
        },
      ],
    });
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.match(html, /&lt;script&gt;/);
  });

  it('thanks / gone pages are self-contained HTML', () => {
    assert.match(renderFormThanksHtml(), /We received your details/);
    assert.match(renderFormGoneHtml(), /Form unavailable/);
  });

  it('app overrides copy and document language', () => {
    const gone = renderFormGoneHtml({ title: 'Formulaire indisponible', message: 'Lien expiré.', lang: 'fr' });
    assert.match(gone, /<html lang="fr">/);
    assert.match(gone, /<h1>Formulaire indisponible<\/h1>/);
    assert.ok(!gone.includes('Form unavailable'));
    assert.match(renderFormGoneHtml('Gone.'), /<p>Gone\.<\/p>/);
    assert.match(renderFormThanksHtml({ title: 'Merci', lang: 'fr' }), /<html lang="fr">/);
    assert.match(
      renderFormHtml({ exposeId: 'abcdefgh-1', formId: 'f', fields: [] }, { lang: 'es' }),
      /<html lang="es">/,
    );
  });
});
