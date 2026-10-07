export class MockVaultAdapter {
  #entries;
  failUpdates = false;

  constructor(entries = []) {
    this.#entries = new Map(entries.map((entry) => [entry.id, structuredClone(entry)]));
  }

  async listEntries() {
    return [...this.#entries.values()].map(({ password, ...entry }) => ({ ...entry, hasPassword: Boolean(password) }));
  }

  async getCredential(id) {
    const entry = this.#entries.get(id);
    if (!entry) throw new Error('Credential not found');
    return structuredClone(entry);
  }

  async updateCredential(id, password) {
    if (this.failUpdates) throw new Error('Simulated vault synchronization failure');
    const entry = this.#entries.get(id);
    if (!entry) throw new Error('Credential not found');
    this.#entries.set(id, { ...entry, password, updatedAt: new Date().toISOString() });
  }
}
