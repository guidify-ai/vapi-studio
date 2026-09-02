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
    assert.match(html, /<form method="post" action="\/forms\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"/);
    assert.match(html, /name="firstName"/);
    assert.match(html, /type="email"/);
    assert.match(html, /<textarea name="address"/);
    assert.match(html, /placeholder="Street"/);
    assert.match(html, /Your details/);
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
});
