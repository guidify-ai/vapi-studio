/**
 * Daily file log driver — banner format, ymd filenames, LOG_DAYS purge.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  appendDailyLog,
  beginCallLog,
  dailyLogFileName,
  flushDailyLog,
  formatCallLogHeader,
  logYmd,
  purgeOldDailyLogs,
  resetDailyLogState,
  resolveLogDays,
  shouldPurgeDailyFile,
  stripAnsi,
} from '../dist/events/daily-log.driver.js';
import { extractVapiCallerNumber } from '../dist/adapters/vapi/vapi-sse.compiler.js';

describe('daily log driver', () => {
  let prevLogDir;
  let prevLogDays;
  let prevFileLog;
  let dir;

  beforeEach(async () => {
    prevLogDir = process.env.LOG_DIR;
    prevLogDays = process.env.LOG_DAYS;
    prevFileLog = process.env.STUDIO_FILE_LOG;
    dir = await mkdtemp(join(tmpdir(), 'studio-logs-'));
    process.env.LOG_DIR = dir;
    process.env.LOG_DAYS = '14';
    process.env.STUDIO_FILE_LOG = '1';
    resetDailyLogState();
  });

  afterEach(async () => {
    resetDailyLogState();
    if (prevLogDir === undefined) delete process.env.LOG_DIR;
    else process.env.LOG_DIR = prevLogDir;
    if (prevLogDays === undefined) delete process.env.LOG_DAYS;
    else process.env.LOG_DAYS = prevLogDays;
    if (prevFileLog === undefined) delete process.env.STUDIO_FILE_LOG;
    else process.env.STUDIO_FILE_LOG = prevFileLog;
    await rm(dir, { recursive: true, force: true });
  });

  it('formats the per-call banner with a trailing blank line', () => {
    assert.equal(
      formatCallLogHeader({
        callId: 'call-vapi-1',
        callerPhone: '+15551234567',
      }),
      [
        '--------------------',
        'Call ID: call-vapi-1',
        'Caller Phone Number: +15551234567',
        '',
        '',
      ].join('\n'),
    );
  });

  it('leaves caller phone empty when the webhook did not send it', () => {
    assert.equal(
      formatCallLogHeader({ callId: 'call-2', callerPhone: null }),
      [
        '--------------------',
        'Call ID: call-2',
        'Caller Phone Number: ',
        '',
        '',
      ].join('\n'),
    );
  });

  it('names daily files dailyYYYYMMDD.log', () => {
    const d = new Date(2026, 7, 18);
    assert.equal(logYmd(d), '20260818');
    assert.equal(dailyLogFileName(d), 'daily20260818.log');
  });

  it('defaults LOG_DAYS to 14 and rejects invalid values', () => {
    assert.equal(resolveLogDays(undefined), 14);
    assert.equal(resolveLogDays(''), 14);
    assert.equal(resolveLogDays('0'), 14);
    assert.equal(resolveLogDays('-3'), 14);
    assert.equal(resolveLogDays('nope'), 14);
    assert.equal(resolveLogDays('7'), 7);
  });

  it('purges daily files at or older than LOG_DAYS', () => {
    const now = new Date(2026, 7, 18);
    assert.equal(shouldPurgeDailyFile('daily20260818.log', now, 14), false);
    assert.equal(shouldPurgeDailyFile('daily20260805.log', now, 14), false);
    assert.equal(shouldPurgeDailyFile('daily20260804.log', now, 14), true);
    assert.equal(shouldPurgeDailyFile('notes.txt', now, 14), false);
  });

  it('writes the call banner then event lines into the daily file', async () => {
    beginCallLog({
      callId: 'call-live-1',
      callerPhone: '+15550001111',
    });
    appendDailyLog(['SYS  TURN hello'], { providerCallId: 'call-live-1' });
    await flushDailyLog();

    const body = await readFile(join(dir, dailyLogFileName()), 'utf8');
    assert.equal(
      body.startsWith(
        [
          '--------------------',
          'Call ID: call-live-1',
          'Caller Phone Number: +15550001111',
          '',
          '',
        ].join('\n'),
      ),
      true,
    );
    assert.match(body, /SYS  TURN hello/);
  });

  it('writes the banner only once per call id', async () => {
    beginCallLog({ callId: 'call-once', callerPhone: '+1' });
    beginCallLog({ callId: 'call-once', callerPhone: '+1' });
    await flushDailyLog();
    const body = await readFile(join(dir, dailyLogFileName()), 'utf8');
    assert.equal(body.split('Call ID: call-once').length - 1, 1);
  });

  it('strips ANSI before writing to disk', async () => {
    appendDailyLog([`\u001B[32mgreen\u001B[0m`], { providerCallId: 'call-ansi' });
    await flushDailyLog();
    const body = await readFile(join(dir, dailyLogFileName()), 'utf8');
    assert.equal(body.includes('\u001B'), false);
    assert.match(body, /green/);
    assert.equal(stripAnsi('\u001B[31mred\u001B[0m'), 'red');
  });

  it('deletes expired daily files and keeps recent ones', async () => {
    const now = new Date(2026, 7, 18);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'daily20260818.log'), 'keep-today', 'utf8');
    await writeFile(join(dir, 'daily20260805.log'), 'keep-13d', 'utf8');
    await writeFile(join(dir, 'daily20260804.log'), 'purge-14d', 'utf8');
    await writeFile(join(dir, 'readme.txt'), 'ignore', 'utf8');

    const removed = await purgeOldDailyLogs({ dir, now, logDays: 14 });
    assert.deepEqual(removed.sort(), ['daily20260804.log']);
    const names = (await readdir(dir)).sort();
    assert.deepEqual(names, [
      'daily20260805.log',
      'daily20260818.log',
      'readme.txt',
    ]);
  });
});

describe('extractVapiCallerNumber', () => {
  it('reads customer.number from a Vapi webhook envelope', () => {
    assert.equal(
      extractVapiCallerNumber({
        message: {
          type: 'status-update',
          call: {
            id: 'call-1',
            customer: { number: '+15551239999' },
          },
        },
      }),
      '+15551239999',
    );
  });

  it('falls back to customer.phoneNumber and call.from', () => {
    assert.equal(
      extractVapiCallerNumber({
        call: { customer: { phoneNumber: '+18005551212' } },
      }),
      '+18005551212',
    );
    assert.equal(extractVapiCallerNumber({ call: { from: '+14155550100' } }), '+14155550100');
    assert.equal(extractVapiCallerNumber({}), null);
  });
});
