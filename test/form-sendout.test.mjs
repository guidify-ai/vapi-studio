/**
 * Form sendout driver stamps conversation + delivery branch early (FORM_SENDOUT).
 */
import assert from 'node:assert/strict';
import { describe, it, mock, before, after } from 'node:test';
import { FormsService } from '../dist/forms/forms.service.js';
import { FormDeliverTimeoutError } from '../dist/forms/form.types.js';

function mockEvents() {
  const persisted = [];
  const emitted = [];
  return {
    persisted,
    emitted,
    log: mock.fn(),
    emit: mock.fn(async (input) => {
      emitted.push(input);
      return { id: 'e1', ...input };
    }),
    persist: mock.fn(async (conversationId, type, payload) => {
      persisted.push({ conversationId, type, payload });
    }),
  };
}

describe('FORM_SENDOUT branch forensics', () => {
  before(() => {
    process.env.STUDIO_FORM_ACK_MS = '40';
  });
  after(() => {
    delete process.env.STUDIO_FORM_ACK_MS;
  });

  it('persists FORM_SENDOUT with conversation branch + deliveryBranch before ACK wait', async () => {
    const events = mockEvents();
    /** @type {FormsService | null} */
    let forms = null;
    const driver = {
      id: 'test-html',
      branch: 'html_link',
      async dispose(payload) {
        forms.ack(payload.exposeId);
      },
    };
    forms = new FormsService(events, driver);

    const exposePromise = forms.expose('conv-form-1', {
      formId: 1,
      branch: 'identity_html_form',
      fields: [
        { name: 'firstName', label: 'First', type: 'string', required: true },
      ],
      disposeContext: { channel: 'web' },
      filloutTimeoutMs: 200,
    });

    await new Promise((r) => setImmediate(r));
    const pending = forms.getLatestPending();
    assert.ok(pending);
    assert.equal(pending.branch, 'identity_html_form');
    assert.equal(pending.deliveryBranch, 'html_link');

    const sendouts = events.persisted.filter((e) => e.type === 'FORM_SENDOUT');
    assert.equal(sendouts.length, 1);
    assert.equal(sendouts[0].payload.branch, 'identity_html_form');
    assert.equal(sendouts[0].payload.deliveryBranch, 'html_link');
    assert.equal(sendouts[0].payload.adapter, 'test-html');

    forms.submit(pending.exposeId, { firstName: 'Mark' });
    const values = await exposePromise;
    assert.equal(values.firstName, 'Mark');
  });

  it('noop driver branch is unavailable and times out deliver', async () => {
    const events = mockEvents();
    const forms = new FormsService(events);
    await assert.rejects(
      () =>
        forms.expose('conv-form-2', {
          formId: 1,
          branch: 'identity_html_form',
          fields: [{ name: 'a', label: 'A', type: 'string' }],
        }),
      (err) => err instanceof FormDeliverTimeoutError,
    );
    const sendouts = events.persisted.filter((e) => e.type === 'FORM_SENDOUT');
    assert.equal(sendouts.length, 1);
    assert.equal(sendouts[0].payload.deliveryBranch, 'unavailable');
    assert.equal(sendouts[0].payload.branch, 'identity_html_form');
  });

  it('resend re-disposes the open expose with the same exposeId', async () => {
    const events = mockEvents();
    /** @type {FormsService | null} */
    let forms = null;
    let disposeCount = 0;
    const driver = {
      id: 'test-html',
      branch: 'html_link',
      async dispose(payload) {
        disposeCount += 1;
        forms.ack(payload.exposeId);
      },
    };
    forms = new FormsService(events, driver);

    const handle = await forms.open('conv-form-3', {
      formId: 1,
      branch: 'identity_html_form',
      fields: [
        { name: 'firstName', label: 'First', type: 'string', required: true },
      ],
      disposeContext: { contactPhone: '5550100999', channel: 'phone' },
      filloutTimeoutMs: 5_000,
    });
    assert.equal(disposeCount, 1);

    const resent = await forms.resend('conv-form-3');
    assert.ok(resent);
    assert.equal(resent.exposeId, handle.exposeId);
    assert.equal(disposeCount, 2);
    assert.equal(
      events.persisted.filter((e) => e.type === 'FORM_RESEND').length,
      1,
    );
    assert.equal(
      events.emitted.filter((e) => e.type === 'FORM_RESENT').length,
      1,
    );
  });
});
