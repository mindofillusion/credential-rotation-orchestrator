import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {randomBytes} from 'node:crypto';import {spawn} from 'node:child_process';
import {FileRecoveryStore} from '../src/adapters/file-recovery-store.js';
import {reconcileRotation,recoveryBinding} from '../src/core/reconcile-rotation.js';
const template={id:'sit.test',version:'1',manifest:{allowedOrigins:['https://example.invalid']}};
async function setup(t){const directory=await mkdtemp(join(tmpdir(),'cro-recovery-'));t.after(()=>rm(directory,{recursive:true,force:true}));const key=randomBytes(32),store=new FileRecoveryStore({directory,key});return {directory,key,store};}
async function fixture(t){const f=await setup(t);const credential={username:'test-user',password:'before'};await f.store.put('account','after',{credential,binding:recoveryBinding(template)});let current={...credential,revision:1},writes=0,probes=0;
 const vault={async getCredential(){return {...current};},async compareAndUpdateCredential(id,password,expected){assert.equal(expected.revision,current.revision);current={...current,password,revision:current.revision+1};writes++;}};
 const runner={async verifyCredential({credential}){probes++;return credential.password==='after';}};
 return {...f,vault,runner,set:v=>{current={...current,...v};},writes:()=>writes,probes:()=>probes,run:()=>reconcileRotation({accountId:'account',template,vault,runner,recoveryStore:f.store})};}

test('encrypted journal survives a killed writer without persisting the key',async t=>{
 const f=await setup(t);const module=new URL('../src/adapters/file-recovery-store.js',import.meta.url).href;
 const script=`import {FileRecoveryStore} from ${JSON.stringify(module)};let input='';for await(const c of process.stdin)input+=c;const p=JSON.parse(input);const s=new FileRecoveryStore({directory:p.directory,key:Buffer.from(p.key,'base64')});await s.put('account','candidate-secret',{credential:{password:'old-secret'}});process.stdout.write('ready\\n');setInterval(()=>{},1000);`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['pipe','pipe','pipe']});t.after(()=>child.kill('SIGKILL'));
 const closed=new Promise(resolve=>child.once('close',resolve));
 const ready=new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(new Error('Child exited before acknowledgement')));});
 child.stdin.end(JSON.stringify({directory:f.directory,key:f.key.toString('base64')}));await ready;child.kill('SIGKILL');await closed;
 const reopened=new FileRecoveryStore({directory:f.directory,key:f.key});assert.equal((await reopened.get('account')).password,'candidate-secret');
 const text=await readFile(f.store.path('account'),'utf8');assert.ok(!text.includes('candidate-secret'));assert.ok(!text.includes('old-secret'));assert.ok(!text.includes(f.key.toString('base64')));
 await assert.rejects(reopened.put('account','replacement'));assert.equal((await reopened.get('account')).password,'candidate-secret');
});

test('wrong key, tampered ciphertext and account substitution are rejected',async t=>{const f=await setup(t);await f.store.put('a','candidate');await assert.rejects(new FileRecoveryStore({directory:f.directory,key:randomBytes(32)}).get('a'));const raw=await readFile(f.store.path('a'),'utf8');await writeFile(f.store.path('b'),raw,{mode:0o600});await assert.rejects(f.store.get('b'));const e=JSON.parse(raw);e.tag=Buffer.alloc(16).toString('base64');await writeFile(f.store.path('a'),JSON.stringify(e));await assert.rejects(f.store.get('a'));});

test('reconciliation verifies site, conditionally writes, reads back and verifies again',async t=>{const f=await fixture(t);assert.equal((await f.run()).status,'succeeded');assert.equal(f.writes(),1);assert.equal(f.probes(),2);assert.equal(await f.store.has('account'),false);});
test('lost previous response: already updated vault is not rewritten',async t=>{const f=await fixture(t);f.set({password:'after'});assert.equal((await f.run()).status,'succeeded');assert.equal(f.writes(),0);});
test('external credential modification is never overwritten',async t=>{const f=await fixture(t);f.set({password:'someone-else-changed-it'});assert.equal((await f.run()).reason,'vault_modified_since_rotation');assert.equal(f.writes(),0);assert.ok(await f.store.has('account'));});
test('failed fresh login prevents vault writes',async t=>{const f=await fixture(t);f.runner.verifyCredential=async()=>false;assert.equal((await f.run()).reason,'site_verification_failed');assert.equal(f.writes(),0);assert.ok(await f.store.has('account'));});
test('failure after a committed write can be reconciled without another write',async t=>{const f=await fixture(t);const update=f.vault.compareAndUpdateCredential;f.vault.compareAndUpdateCredential=async(...a)=>{await update(...a);throw new Error('secret-error');};assert.equal((await f.run()).reason,'vault_write_failed');assert.ok(await f.store.has('account'));assert.equal((await f.run()).status,'succeeded');assert.equal(f.writes(),1);});
test('stale readback and missing conditional write preserve recovery',async t=>{const f=await fixture(t);f.vault.compareAndUpdateCredential=async()=>{};assert.equal((await f.run()).reason,'vault_readback_failed');delete f.vault.compareAndUpdateCredential;assert.equal((await f.run()).reason,'conditional_write_unavailable');assert.ok(await f.store.has('account'));});
test('another process lock and changed template block recovery',async t=>{const f=await fixture(t);await writeFile(f.store.path('account')+'.lock','',{mode:0o600});assert.equal((await f.run()).reason,'recovery_lock_present');await rm(f.store.path('account')+'.lock');const result=await reconcileRotation({accountId:'account',template:{...template,version:'2'},vault:f.vault,runner:f.runner,recoveryStore:f.store});assert.equal(result.reason,'recovery_context_mismatch');assert.equal(f.writes(),0);});


test('identity change and failed login with readback preserve the journal',async t=>{const f=await fixture(t);f.set({username:'other'});assert.equal((await f.run()).reason,'vault_identity_changed');f.set({username:'test-user',password:'after'});let n=0;f.runner.verifyCredential=async()=>++n===1;assert.equal((await f.run()).reason,'vault_credential_login_failed');assert.ok(await f.store.has('account'));assert.equal(f.writes(),0);});
