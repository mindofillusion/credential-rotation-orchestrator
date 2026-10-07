export class SimulationRunner {
  constructor({ outcome = 'success' } = {}) {
    this.outcome = outcome;
  }

  async execute({ template, credential, nextPassword }) {
    if (!template || !credential?.password || !nextPassword) {
      throw new Error('Runner received incomplete rotation material');
    }
    if (this.outcome === 'failure') throw new Error('Simulated website rejection');
    if (this.outcome === 'ambiguous') return { remoteChanged: true, verified: false };
    return { remoteChanged: true, verified: true };
  }
}
