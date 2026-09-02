import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  canonicalRequestBody,
  readSecretEnv,
  sha256Hex,
  signHs256Jwt,
  signIntegrationRequest,
  verifyHs256Jwt,
} from '../dist/integrations/jwt-hmac.js';
import { IntegrationClient } from '../dist/integrations/integration-client.js';
import { EventService } from '../dist/events/event.service.js';
import { RA9_EVENTS } from '../dist/events/ra9-event.js';

describe('JWT HMAC integration auth', () => {
  it('signs and verifies HS256 JWT', () => {
    const token = signHs256Jwt({ sub: 'ra9', n: 1 }, 'test-secret');
    const claims = verifyHs256Jwt(token, 'test-secret');
    assert.equal(claims.sub, 'ra9');
    assert.throws(() => verifyHs256Jwt(token, 'wrong'), /HMAC/);
  });

  it('binds method, url, and body sha256 into the JWT', () => {
    const body = canonicalRequestBody({ slot: '10am' });
    const { token, bodySha256, claims } = signIntegrationRequest({
      secret: 's3cret',
      method: 'post',
      url: 'https://api.example.com/availability',
      body,
    });
    assert.equal(bodySha256, sha256Hex(body));
    assert.equal(claims.method, 'POST');
    assert.equal(claims.url, 'https://api.example.com/availability');
    const verified = verifyHs256Jwt(token, 's3cret');
    assert.equal(verified.bodySha256, bodySha256);
  });

  it('readSecretEnv requires the named .env key', () => {
    delete process.env.TEST_INTEGRATION_SECRET;
    assert.throws(() => readSecretEnv('TEST_INTEGRATION_SECRET'), /TEST_INTEGRATION_SECRET/);
    process.env.TEST_INTEGRATION_SECRET = 'abc';
    assert.equal(readSecretEnv('TEST_INTEGRATION_SECRET'), 'abc');
    delete process.env.TEST_INTEGRATION_SECRET;
  });
});

describe('IntegrationClient events', () => {
  it('emits request + response and sends x-signature', async () => {
    process.env.FAKE_INT_SECRET = 'hmac-secret';
    const handled = [];
    const events = new EventService([
      {
        handle: (event) => {
          handled.push(event);
        },
      },
    ]);
    const client = new IntegrationClient(events);

    const fetchMock = mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(String(url), 'https://example.test/v1/slots');
      const headers = init.headers;
      assert.ok(headers['x-signature']);
      assert.equal(init.method, 'POST');
      return new Response(JSON.stringify({ slots: 3 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const result = await client.request({
      name: 'example.slots',
      url: 'https://example.test/v1/slots',
      body: { day: 'tomorrow' },
      secretEnvKey: 'FAKE_INT_SECRET',
      meta: { conversationId: 'conv-1' },
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { slots: 3 });
    assert.equal(handled[0].type, RA9_EVENTS.INTEGRATION_REQUEST);
    assert.equal(handled[0].conversationId, 'conv-1');
    assert.equal(handled[0].payload.name, 'example.slots');
    assert.equal(handled[1].type, RA9_EVENTS.INTEGRATION_RESPONSE);
    assert.equal(handled[1].payload.status, 200);
    fetchMock.mock.restore();
    delete process.env.FAKE_INT_SECRET;
  });
});
