import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const c=JSON.parse(await readFile(new URL('../sit/lab/recipe-compose.json',import.meta.url)));
test('lab recipe pins artifacts and confines publication to fixed gateways',()=>{
  assert.equal(Object.keys(c.services).length,6);
  for(const [name,s]of Object.entries(c.services)){
    assert.match(s.image,/@sha256:[a-f0-9]{64}$/);assert.equal(s.restart,'no');assert.ok(s.mem_limit);assert.ok(s.cpus<=1);assert.deepEqual(s.cap_drop,['ALL']);assert.deepEqual(s.security_opt,['no-new-privileges:true']);assert.ok(!JSON.stringify(s).includes('docker.sock'));
    if(name.startsWith('gateway-')){assert.ok(s.ports.every(p=>p.startsWith('127.0.0.1:')));assert.equal(s.networks.length,2);assert.equal(s.read_only,true);}else{assert.equal(s.ports,undefined);assert.equal(s.networks.length,1);assert.equal(c.networks[s.networks[0]].internal,true);}
  }
});
test('mail capture has no relay and only accepts fictitious recipients',()=>{for(const pair of ['current','previous']){const e=c.services['mail-'+pair].environment;assert.equal(e.MP_SMTP_ALLOWED_RECIPIENTS,'@example\\.invalid$');assert.ok(!Object.keys(e).some(k=>/RELAY|FORWARD/.test(k)));assert.equal(e.MP_DISABLE_VERSION_CHECK,'true');}});
