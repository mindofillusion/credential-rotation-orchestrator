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
  const { vault, orchestrator, recoveryStore } = createContext('failure');
  const before = await vault.getCredential('a1');
  const result = await orchestrator.rotate({ accountId: 'a1', template });
  const after = await vault.getCredential('a1');
  assert.equal(result.status, 'failed');
  assert.equal(after.password, before.password);
  assert.equal(recoveryStore.has('a1'), false);
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

test('does not enter the browser if write-ahead recovery storage fails', async () => {
  const {orchestrator, events} = createContext();
  let executed=false;
  orchestrator.recoveryStore.put=async()=>{throw new Error('secret-value');};
  orchestrator.runner.execute=async()=>{executed=true;};
  const result=await orchestrator.rotate({accountId:'a1',template});
  assert.equal(result.status,'failed');
  assert.equal(executed,false);
  assert.ok(!JSON.stringify(events.history()).includes('secret-value'));
});

test('a thrown browser after submission is ambiguous and keeps its candidate', async () => {
  const {orchestrator,recoveryStore,events}=createContext();
  orchestrator.runner.execute=async()=>{assert.ok(recoveryStore.has('a1'));throw new Error('private-password-or-link');};
  const result=await orchestrator.rotate({accountId:'a1',template});
  assert.equal(result.status,'ambiguous');
  assert.equal(result.remoteChanged,null);
  assert.ok(recoveryStore.has('a1'));
  assert.ok(!JSON.stringify(events.history()).includes('private-password-or-link'));
  assert.deepEqual(await orchestrator.rotate({accountId:'a1',template}),{status:'blocked',reason:'recovery_pending'});
});

test('an acknowledged write with stale readback cannot succeed', async () => {
  const {orchestrator,vault,recoveryStore,events}=createContext();
  vault.updateCredential=async()=>{};
  const result=await orchestrator.rotate({accountId:'a1',template});
  assert.equal(result.status,'ambiguous');
  assert.equal(result.vaultUpdated,false);
  assert.ok(recoveryStore.has('a1'));
  assert.equal(events.history()[0].data.reason,'vault_readback_failed');
});

test('a lost write response retains recovery even if the write landed', async () => {
  const {orchestrator,vault,recoveryStore}=createContext();
  const update=vault.updateCredential.bind(vault);
  vault.updateCredential=async(...args)=>{await update(...args);throw new Error('connection lost');};
  assert.equal((await orchestrator.rotate({accountId:'a1',template})).status,'ambiguous');
  assert.ok(recoveryStore.has('a1'));
});

test('readback of another username is rejected even with matching password', async () => {
  const {orchestrator,vault}=createContext();
  const read=vault.getCredential.bind(vault);let count=0;
  vault.getCredential=async id=>({...await read(id),username:++count===1?'owner':'different-owner'});
  assert.equal((await orchestrator.rotate({accountId:'a1',template})).status,'ambiguous');
});

test('concurrent attempts cannot replace a pending candidate', async () => {
  const {orchestrator,recoveryStore}=createContext();
  let release,entered;
  const ready=new Promise(r=>{entered=r;});
  orchestrator.runner.execute=async()=>{entered();await new Promise(r=>{release=r;});return {remoteChanged:true,verified:true};};
  const first=orchestrator.rotate({accountId:'a1',template});await ready;
  assert.deepEqual(await orchestrator.rotate({accountId:'a1',template}),{status:'blocked',reason:'rotation_in_progress'});
  release();assert.equal((await first).status,'succeeded');
  assert.equal(recoveryStore.has('a1'),false);
});
