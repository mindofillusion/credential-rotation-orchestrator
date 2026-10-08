import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {verifyPatch} from '../src/updates/patch.js';
import {canonicalJson} from '../src/core/canonical-json.js';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
function bundle(){const files={'package.json':JSON.stringify({name:'credential-rotation-orchestrator',version:'0.2.5'}),'bin/cro.js':'// entry','src/server/main.js':'// server'};const manifest={format:'cro-patch-v1',application:'credential-rotation-orchestrator',version:'0.2.5',allowedFrom:['0.2.4'],expiresAt:'2099-01-01',files:Object.entries(files).map(([path,data])=>({path,sha256:createHash('sha256').update(data).digest('hex')}))};return {manifest,files:Object.fromEntries(Object.entries(files).map(([p,d])=>[p,Buffer.from(d).toString('base64')])),signature:sign(null,Buffer.from(canonicalJson(manifest)),privateKey).toString('base64')};}
const check=p=>verifyPatch(p,{publicKey,currentVersion:'0.2.4'});
test('signed patch accepts exact base and hashes',()=>assert.equal(check(bundle()).manifest.version,'0.2.5'));
test('patch rejects modified bytes, manifest and extra files',()=>{let p=bundle();p.files['bin/cro.js']=Buffer.from('tampered').toString('base64');assert.throws(()=>check(p));p=bundle();p.manifest.version='0.2.6';assert.throws(()=>check(p));p=bundle();p.files['evil.js']='';assert.throws(()=>check(p));});
test('patch rejects unknown issuer, wrong base and expired release',()=>{assert.throws(()=>verifyPatch(bundle(),{publicKey:generateKeyPairSync('ed25519').publicKey,currentVersion:'0.2.4'}));assert.throws(()=>verifyPatch(bundle(),{publicKey,currentVersion:'0.2.3'}));assert.throws(()=>verifyPatch(bundle(),{publicKey,currentVersion:'0.2.4',now:Date.parse('2100-01-01')}));});
test('even signed path traversal is refused',()=>{const p=bundle();p.manifest.files[1].path='src/../../evil.js';p.signature=sign(null,Buffer.from(canonicalJson(p.manifest)),privateKey).toString('base64');assert.throws(()=>check(p),/Chemin/);});
