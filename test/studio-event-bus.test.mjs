import assert from 'node:assert/strict';
import test from 'node:test';
import { EventService } from '../dist/events/event.service.js';
import {
  STUDIO_EVENT_BUS_CHANNEL,
  onStudioEvent,
  studioEventBus,
} from '../dist/events/studio-event-bus.js';

test('EventService.emit fans out to Node EventEmitter bus', async () => {
  const seen = [];
  const stop = onStudioEvent((event) => {
    seen.push(event);
  });
  const events = new EventService([]);
  const emitted = await events.emit({
    type: 'TEST_BUS',
    conversationId: '00000000-0000-4000-8000-000000000001',
    payload: { ok: true },
  });
  stop();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].id, emitted.id);
  assert.equal(seen[0].type, 'TEST_BUS');
  assert.equal(seen[0].payload.ok, true);
  assert.equal(STUDIO_EVENT_BUS_CHANNEL, 'studio.event');
  assert.ok(studioEventBus());
});

test('EventService.emit still invokes StudioEventListener', async () => {
  const handled = [];
  const events = new EventService([
    {
      handle(event) {
        handled.push(event.type);
      },
    },
  ]);
  await events.emit({ type: 'TEST_LISTENER', payload: {} });
  assert.deepEqual(handled, ['TEST_LISTENER']);
});
