export class MemoryRecoveryStore {
  #values = new Map();

  async put(accountId, password) {
    if (this.#values.has(accountId)) throw new Error('Recovery already pending');
    this.#values.set(accountId, password);
  }

  has(accountId) {
    return this.#values.has(accountId);
  }

  clear(accountId) {
    this.#values.delete(accountId);
  }
}
