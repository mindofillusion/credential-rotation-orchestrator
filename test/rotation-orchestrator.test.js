import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/event-bus.js';
import { RotationOrchestrator } from '../src/core/rotation-orchestrator.js';
import { MockVaultAdapter } from '../src/adapters/mock-vault.js';
import { MemoryRecoveryStore } from '../src/adapters/memory-recovery-store.js';
import { SimulationRunner } from '../src/adapters/simulation-runner.js';

const template = {
  id: 'org.example.change-password',
  version: '1.0.0',
  manifest: { allowedOrigins: ['https://example.com'] }
};

function createContext(outcome = 'success') {
  const vault = new MockVaultAdapter([{ id: 'a1', password: 'old-password' }]);
  const events = new EventBus();
  const recoveryStore = new MemoryRecoveryStore();
  const orchestrator = new RotationOrchestrator({
    vault,
    events,
    recoveryStore,
    runner: new SimulationRunner({ outcome })
  });
  return { vault, events, recoveryStore, orchestrator };
}

test('updates the vault only after a verified remote change', async () => {
  const { vault, orchestrator } = createContext();
  const before = await vault.getCredential('a1');
  const result = await orchestrator.rotate({ accountId: 'a1', template });
  const after = await vault.getCredential('a1');
  assert.equal(result.status, 'succeeded');
  assert.notEqual(after.password, before.password);
});

test('does not update the vault after a remote failure', async () => {
  const { vault, orchestrator } = createContext('failure');
  const before = await vault.getCredential('a1');
  const result = await orchestrator.rotate({ accountId: 'a1', template });
  const after = await vault.getCredential('a1');
  assert.equal(result.status, 'failed');
  assert.equal(after.password, before.password);
});

test('marks the transaction ambiguous when verification fails', async () => {
  const { events, orchestrator } = createContext('ambiguous');
  const result = await orchestrator.rotate({ accountId: 'a1', template });
  assert.equal(result.status, 'ambiguous');
  assert.equal(events.history()[0].type, 'credential.rotation.state_ambiguous');
});

test('stores a recovery secret when the remote change succeeds but vault update fails', async () => {
  const { vault, recoveryStore, events, orchestrator } = createContext();
  vault.failUpdates = true;
  const result = await orchestrator.rotate({ accountId: 'a1', template });
  assert.equal(result.status, 'ambiguous');
  assert.equal(recoveryStore.has('a1'), true);
  assert.equal(events.history()[0].data.reason, 'vault_update_failed');
});
