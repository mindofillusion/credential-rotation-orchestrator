import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/event-bus.js';

test('redacts nested secret-like fields from emitted events', () => {
  const bus = new EventBus();
  const event = bus.emit('test.event', 'account/opaque', {
    password: 'do-not-leak',
    nested: { accessToken: 'also-secret', safe: 'visible' }
  });
  assert.equal(event.data.password, '[REDACTED]');
  assert.equal(event.data.nested.accessToken, '[REDACTED]');
  assert.equal(event.data.nested.safe, 'visible');
  assert.doesNotMatch(JSON.stringify(event), /do-not-leak|also-secret/);
});
