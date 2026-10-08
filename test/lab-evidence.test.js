import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {readLabEvidence} from '../src/lab/evidence.js';
test('reports are filtered and latest failure cannot inherit an older success',async t=>{
 const root=await mkdtemp(join(tmpdir(),'cro-evidence-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const good={phase:'complete',completedAt:'2026-10-08T12:00:00Z',secret:'DO_NOT_EXPOSE',realm:'DO_NOT_EXPOSE',linkValidated:true,passwordChanged:true,newPasswordLogin:true,oldPasswordRejected:true,reusedLinkRejected:true,expiredLinkRejected:true,passwordRetainedAfterExpiry:true,vaultUpdated:true};
 await writeFile(join(root,'bootstrap-private.json'),JSON.stringify({password:'DO_NOT_EXPOSE'}));await writeFile(join(root,'email-browser-current-1791450000000.json'),JSON.stringify(good));
 let result=await readLabEvidence(root);assert.equal(result.pairs[0].siteVerified,true);assert.equal(result.pairs[0].vaultVerified,false);assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
 await writeFile(join(root,'email-browser-current-1791450000001.json'),JSON.stringify({...good,failed:true,phase:'old-password'}));result=await readLabEvidence(root);assert.equal(result.pairs[0].siteVerified,false);
});
