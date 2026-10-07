import { randomUUID } from 'node:crypto';

function redact(value) {
  if (!value || typeof value !== 'object') return value;
  const output = Array.isArray(value) ? [] : {};
  for (const [key, item] of Object.entries(value)) {
    if (/password|secret|token|cookie|authorization/i.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redact(item);
    }
  }
  return output;
}

export class EventBus {
  #listeners = new Set();
  #history = [];

  emit(type, subject, data = {}) {
    const event = Object.freeze({
      specversion: '1.0',
      id: randomUUID(),
      type,
      source: 'local/credential-rotation-orchestrator',
      subject,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: redact(data)
    });
    this.#history.unshift(event);
    this.#history = this.#history.slice(0, 250);
    for (const listener of this.#listeners) listener(event);
    return event;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  history() {
    return structuredClone(this.#history);
  }
}
