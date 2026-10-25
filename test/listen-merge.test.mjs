import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeSayAndListenOptions,
  mockExtractPersonName,
  tryResolveListenIntention,
} from '../dist/conversation/listen-expectation.js';

describe('sayAndListen options', () => {
  it('merge per-turn options over listen(); no extraction on a listen', () => {
    const merged = mergeSayAndListenOptions(
      {
        intentions: [{ name: 'isCollectedPhone', boost: 20 }],
        hints: ['phone number'],
      },
      { hints: ['ten digits'], timeoutSeconds: 4 },
    );
    assert.equal(merged?.intentions[0].name, 'isCollectedPhone');
    assert.deepEqual(merged?.hints, ['ten digits']);
    assert.equal(merged?.timeoutSeconds, 4);
    assert.equal('extract' in merged, false);
  });

  it('mergeSayAndListenOptions keeps resolveIntention', async () => {
    const merged = mergeSayAndListenOptions(
      {
        intentions: [{ name: 'isConfirmedAddressMatch', boost: 20 }],
      },
      {
        resolveIntention: ({ userText }) =>
          /first/i.test(userText) ? 'isConfirmedAddressMatch' : null,
      },
    );
    const name = await tryResolveListenIntention({
      listen: merged,
      userText: 'It is the first option.',
      memory: {},
    });
    assert.equal(name, 'isConfirmedAddressMatch');
    assert.equal(
      await tryResolveListenIntention({
        listen: merged,
        userText: 'transfer me',
        memory: {},
      }),
      null,
    );
  });
});

describe('mockExtractPersonName (Node-side helper)', () => {
  it('pulls a name from short voice answers', () => {
    assert.equal(mockExtractPersonName('My name is Mark'), 'Mark');
    assert.equal(mockExtractPersonName('Sarah'), 'Sarah');
    assert.equal(mockExtractPersonName('Mark.'), 'Mark');
    assert.equal(mockExtractPersonName('yeah Mark'), 'Mark');
    assert.equal(mockExtractPersonName('Mark Pyskunov', 'last'), 'Pyskunov');
  });

  it('does not invent names from intent sentences or fillers', () => {
    assert.equal(mockExtractPersonName('I need an estimate.'), undefined);
    assert.equal(mockExtractPersonName('I'), undefined);
    assert.equal(mockExtractPersonName('Okay'), undefined);
    assert.equal(mockExtractPersonName('3'), undefined);
  });
});
