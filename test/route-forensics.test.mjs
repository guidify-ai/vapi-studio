/**
 * Memory snapshots + route forensic helpers used by ROUTE_DECISION / NODE_AFTER.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { snapshotUserMemory } from '../dist/events/conversation-console.js';
import {
  actionForensics,
  listenForensics,
  nodeResultForensics,
  truncateForLog,
  walkForensics,
} from '../dist/events/route-forensics.js';

describe('snapshotUserMemory (call forensics)', () => {
  it('keeps introSpoken and other conversation flags (including false)', () => {
    const snap = snapshotUserMemory({
      introSpoken: true,
      phoneConfirmed: false,
      formSendConsent: true,
      contactPhone: '5550100999',
      conversationReady: true,
      setupAt: '2026-01-01',
      tornDownAt: null,
      empty: '',
      gone: undefined,
    });
    assert.equal(snap.introSpoken, true);
    assert.equal(snap.phoneConfirmed, false);
    assert.equal(snap.formSendConsent, true);
    assert.equal(snap.contactPhone, '5550100999');
    assert.equal(Object.prototype.hasOwnProperty.call(snap, 'conversationReady'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snap, 'setupAt'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snap, 'empty'), false);
  });

  it('returns {} for nullish memory', () => {
    assert.deepEqual(snapshotUserMemory(null), {});
    assert.deepEqual(snapshotUserMemory(undefined), {});
  });
});

describe('route-forensics helpers', () => {
  it('truncateForLog caps long speech', () => {
    assert.equal(truncateForLog('short'), 'short');
    assert.equal(truncateForLog('  '), undefined);
    const long = 'x'.repeat(250);
    const out = truncateForLog(long, 200);
    assert.equal(out.length, 200);
    assert.ok(out.endsWith('...'));
  });

  it('walkForensics surfaces confidence, priority, listenBoost, reason', () => {
    const walk = walkForensics([
      {
        name: 'studio.isPositive',
        confidence: 0.91,
        priority: 1,
        rank: 0,
        payload: { listenBoost: 24, reason: 'listen_resolve' },
      },
    ]);
    assert.deepEqual(walk, [
      {
        name: 'studio.isPositive',
        confidence: 0.91,
        priority: 1,
        listenBoost: 24,
        reason: 'listen_resolve',
      },
    ]);
  });

  it('listenForensics includes boosts and extract keys', () => {
    const row = listenForensics({
      intentions: [
        { name: 'isCollectedPhone', boost: 28 },
        { name: 'studio.isPositive', boost: 8 },
      ],
      extract: { fields: [{ key: 'phone', type: 'string', required: true }] },
      timeoutSeconds: 1,
      resolveIntention: () => null,
    });
    assert.deepEqual(row.intentions, [
      { name: 'isCollectedPhone', boost: 28, priority: undefined },
      { name: 'studio.isPositive', boost: 8, priority: undefined },
    ]);
    assert.deepEqual(row.extractKeys, ['phone']);
    assert.equal(row.timeoutSeconds, 1);
    assert.equal(row.hasResolveIntention, true);
  });

  it('nodeResultForensics records continueTo target + reason + say text', () => {
    const detail = nodeResultForensics({
      kind: 'continueTo',
      text: 'unused',
      continueToNodeId: 'identityCollect',
      handoffReason: 'sms_phone_confirmed',
    });
    assert.equal(detail.kind, 'continueTo');
    assert.equal(detail.continueToNodeId, 'identityCollect');
    assert.equal(detail.reason, 'sms_phone_confirmed');
    assert.equal(detail.text, 'unused');
  });

  it('actionForensics keeps kind + continueTo + truncated text', () => {
    const rows = actionForensics([
      { kind: 'say', text: 'hi' },
      {
        kind: 'continueTo',
        continueToNodeId: 'askSmsPhone',
        handoffReason: 'need_sms_phone',
      },
    ]);
    assert.deepEqual(rows, [
      { kind: 'say', text: 'hi' },
      {
        kind: 'continueTo',
        continueToNodeId: 'askSmsPhone',
        reason: 'need_sms_phone',
      },
    ]);
  });
});
