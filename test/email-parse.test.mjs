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
  assert.equal(parseSpelledEmail('jane@example.com'), 'jane@example.com');
  assert.equal(
    parseSpelledEmail('Email is Jane.Doe@Example.COM thanks'),
    'jane.doe@example.com',
  );
  assert.equal(parseSpelledEmail('hello'), null);
  assert.equal(parseSpelledEmail(''), null);
});

test('parseSpelledEmail: spelled at / dot', () => {
  assert.equal(
    parseSpelledEmail('jane at example dot com'),
    'jane@example.com',
  );
  assert.equal(
    parseSpelledEmail('j a n e at e x a m p l e dot com'),
    'jane@example.com',
  );
  assert.equal(
    parseSpelledEmail('jane at the rate example period com'),
    'jane@example.com',
  );
});

test('parseSpelledEmail: letter O as digit zero', () => {
  assert.equal(
    parseSpelledEmail('f 0 0 at example dot com'),
    'foo@example.com',
  );
});

test('collectedEmail prefers extract over spoken', () => {
  assert.equal(
    collectedEmail('jane@example.com', 'sure'),
    'jane@example.com',
  );
  assert.equal(
    collectedEmail(undefined, 'jane at example dot com'),
    'jane@example.com',
  );
  assert.equal(collectedEmail('nope', 'still no'), null);
});
