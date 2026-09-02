import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeSayAndListenOptions,
  missingRequiredExtractKeys,
  mockExtractFromUserText,
  tryResolveListenIntention,
} from '../dist/conversation/listen-expectation.js';

describe('Listen extraction', () => {
  it('mockExtractFromUserText pulls first name phrases', () => {
    assert.deepEqual(
      mockExtractFromUserText('My name is Mark', [
        { key: 'firstName', type: 'string' },
      ]),
      { firstName: 'Mark' },
    );
    assert.deepEqual(
      mockExtractFromUserText('Sarah', [{ key: 'firstName' }]),
      { firstName: 'Sarah' },
    );
    assert.deepEqual(
      mockExtractFromUserText('Mark.', [{ key: 'firstName' }]),
      { firstName: 'Mark' },
    );
    assert.deepEqual(
      mockExtractFromUserText('yeah Mark', [{ key: 'firstName' }]),
      { firstName: 'Mark' },
    );
    assert.deepEqual(
      mockExtractFromUserText('Pyskunov.', [{ key: 'lastName' }]),
      { lastName: 'Pyskunov' },
    );
  });

  it('mockExtractFromUserText does not invent names from intent sentences', () => {
    assert.deepEqual(
      mockExtractFromUserText('I need my roof estimate.', [
        { key: 'firstName', type: 'string', required: true },
      ]),
      {},
    );
    assert.deepEqual(
      mockExtractFromUserText('I', [{ key: 'firstName' }]),
      {},
    );
    assert.deepEqual(
      mockExtractFromUserText('Okay', [{ key: 'lastName' }]),
      {},
    );
    assert.deepEqual(
      mockExtractFromUserText('3', [{ key: 'lastName' }]),
      {},
    );
  });

  it('missingRequiredExtractKeys reports absent required fields', () => {
    assert.deepEqual(
      missingRequiredExtractKeys(
        [{ key: 'firstName', required: true }],
        {},
      ),
      ['firstName'],
    );
    assert.deepEqual(
      missingRequiredExtractKeys(
        [{ key: 'firstName', required: true }],
        { firstName: 'Ada' },
      ),
      [],
    );
  });

  it('mergeSayAndListenOptions keeps onExtracted callback', async () => {
    const memory = {};
    const merged = mergeSayAndListenOptions(
      {
        intentions: [{ name: 'isMultiSayTest', boost: 20 }],
        hints: ['name answer'],
      },
      {
        extract: {
          fields: [
            {
              key: 'firstName',
              required: true,
            },
          ],
          onExtracted: (data) => {
            memory.callerName = data.firstName;
          },
        },
      },
    );
    assert.equal(merged?.intentions[0].name, 'isMultiSayTest');
    assert.equal(merged?.extract?.fields[0].key, 'firstName');
    await merged?.extract?.onExtracted?.(
      { firstName: 'Ada' },
      { memory, variables: {}, userText: 'Ada' },
    );
    assert.equal(memory.callerName, 'Ada');
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
