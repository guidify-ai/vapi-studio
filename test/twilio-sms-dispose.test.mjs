/**
 * Twilio SMS form dispose — dry-run by default; no live Twilio SDK required.
 */
import assert from 'node:assert/strict';
import { describe, it, mock, before, after } from 'node:test';
import { TwilioSmsFormDisposeAdapter } from '../dist/forms/twilio-sms-form-dispose.adapter.js';
import {
  normalizeSmsToE164,
  readTwilioSmsConfig,
  resolveTwilioSmsConfig,
  TWILIO_SMS_ENV,
} from '../dist/forms/twilio-sms.env.js';
import { DryRunTwilioSmsSender } from '../dist/forms/twilio-sms.sender.js';

function mockEvents() {
  return {
    log: mock.fn(),
    persist: mock.fn(async () => undefined),
    emit: mock.fn(async (input) => ({ id: 'e1', ...input })),
  };
}

describe('Twilio SMS env + dispose adapter', () => {
  const prev = {};

  before(() => {
    for (const key of Object.values(TWILIO_SMS_ENV)) {
      prev[key] = process.env[key];
      delete process.env[key];
    }
  });

  after(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults TWILIO_SMS_DRY_RUN to on', () => {
    const cfg = readTwilioSmsConfig({});
    assert.equal(cfg.dryRun, true);
    const resolved = resolveTwilioSmsConfig({});
    assert.equal(resolved.ok, true);
    assert.equal(resolved.config.dryRun, true);
  });

  it('normalizes NA mobiles to E.164', () => {
    assert.equal(normalizeSmsToE164('5550100999'), '+15550100999');
    assert.equal(normalizeSmsToE164('+15550100999'), '+15550100999');
    assert.equal(normalizeSmsToE164(''), null);
  });

  it('dry-run dispose persists OUTBOUND_NOTIFICATION and ACKs without twilio package', async () => {
    process.env.TWILIO_SMS_DRY_RUN = '1';
    const events = mockEvents();
    const forms = { ack: mock.fn(() => null) };
    const adapter = new TwilioSmsFormDisposeAdapter(
      events,
      forms,
      new DryRunTwilioSmsSender(),
    );

    await adapter.dispose({
      exposeId: 'exp-1',
      formId: 1,
      conversationId: 'conv-sms-1',
      fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
      branch: 'identity_sms_form',
      disposeContext: {
        contactPhone: '5550100999',
        formUrl: 'https://example.test/forms/abc',
      },
    });

    assert.equal(adapter.branch, 'sms');
    assert.equal(adapter.id, 'twilio-sms');
    assert.equal(forms.ack.mock.callCount(), 1);
    assert.equal(forms.ack.mock.calls[0].arguments[0], 'exp-1');

    assert.equal(events.persist.mock.callCount(), 1);
    const [conversationId, type, payload] = events.persist.mock.calls[0].arguments;
    assert.equal(conversationId, 'conv-sms-1');
    assert.equal(type, 'OUTBOUND_NOTIFICATION');
    assert.equal(payload.channel, 'sms');
    assert.equal(payload.provider, 'twilio');
    assert.equal(payload.status, 'dry_run');
    assert.equal(payload.to, '+15550100999');
    assert.match(payload.body, /example\.test\/forms\/abc/);
    assert.equal(payload.dryRun, true);
    assert.equal(payload.sid.startsWith('dryrun_'), true);
  });

  it('missing contactPhone persists OUTBOUND_NOTIFICATION_ERROR', async () => {
    process.env.TWILIO_SMS_DRY_RUN = '1';
    const events = mockEvents();
    const adapter = new TwilioSmsFormDisposeAdapter(
      events,
      undefined,
      new DryRunTwilioSmsSender(),
    );
    await assert.rejects(
      () =>
        adapter.dispose({
          exposeId: 'x',
          formId: 1,
          conversationId: 'c',
          fields: [],
          disposeContext: { formUrl: 'https://example.test/f' },
        }),
      /contactPhone/,
    );
    assert.equal(events.persist.mock.callCount(), 1);
    assert.equal(events.persist.mock.calls[0].arguments[1], 'OUTBOUND_NOTIFICATION_ERROR');
    assert.equal(events.persist.mock.calls[0].arguments[2].status, 'error');
  });
});
