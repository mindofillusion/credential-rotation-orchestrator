export class MemoryRecoveryStore {
  #values = new Map();

  async put(accountId, password) {
    this.#values.set(accountId, password);
  }

  has(accountId) {
    return this.#values.has(accountId);
  }

  clear(accountId) {
    this.#values.delete(accountId);
  }
}
