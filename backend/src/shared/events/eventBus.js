const { EventEmitter } = require('events');

class InternalEventBus extends EventEmitter {
  async emitAsync(type, payload) {
    const listeners = this.listeners(type);
    if (!listeners.length) return;
    await Promise.allSettled(listeners.map((fn) => Promise.resolve().then(() => fn(payload))));
  }
}

const eventBus = new InternalEventBus();

module.exports = { eventBus, InternalEventBus };
