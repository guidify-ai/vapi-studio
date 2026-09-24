import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMAIL_EXTRACT_DESCRIPTION,
  collectedEmail,
  parseSpelledEmail,
} from '../dist/identity/email-parse.js';

test('EMAIL_EXTRACT_DESCRIPTION teaches spelled ASR', () => {
  assert.match(EMAIL_EXTRACT_DESCRIPTION, /spelled-out ASR/i);
  assert.match(EMAIL_EXTRACT_DESCRIPTION, /\bat\b/i);
  assert.match(EMAIL_EXTRACT_DESCRIPTION, /\bdot\b/i);
});

test('parseSpelledEmail: direct address', () => {
  assert.equal(parseSpelledEmail('mark@roofr.com'), 'mark@roofr.com');
  assert.equal(
    parseSpelledEmail('Email is Mark.Pyskunov@Example.COM thanks'),
    'mark.pyskunov@example.com',
  );
  assert.equal(parseSpelledEmail('hello'), null);
  assert.equal(parseSpelledEmail(''), null);
});

test('parseSpelledEmail: spelled at / dot', () => {
  assert.equal(
    parseSpelledEmail('mark at roofr dot com'),
    'mark@roofr.com',
  );
  assert.equal(
    parseSpelledEmail('m a r k at r o o f r dot com'),
    'mark@roofr.com',
  );
  assert.equal(
    parseSpelledEmail('mark at the rate example period com'),
    'mark@example.com',
  );
});

test('parseSpelledEmail: letter O as digit zero', () => {
  assert.equal(
    parseSpelledEmail('r o 0 f r at example dot com'),
    'roofr@example.com',
  );
});

test('collectedEmail prefers extract over spoken', () => {
  assert.equal(
    collectedEmail('mark@roofr.com', 'sure'),
    'mark@roofr.com',
  );
  assert.equal(
    collectedEmail(undefined, 'mark at roofr dot com'),
    'mark@roofr.com',
  );
  assert.equal(collectedEmail('nope', 'still no'), null);
});
