import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {request} from 'node:http';
import {fileURLToPath} from 'node:url';
test('laboratory API requires loopback Host, matching Origin and token',async t=>{
  const data=await mkdtemp(join(tmpdir(),'cro-lab-http-'));
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('CRO_')));
  const child=spawn(process.execPath,['bin/cro.js','--port',String(port),'--data-dir',data],{cwd:fileURLToPath(new URL('../',import.meta.url)),env,stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}await rm(data,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${port}`;let ready=false;
  for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,30));}
  assert.ok(ready,'server starts');
  const badHost=await new Promise((resolve,reject)=>{const req=request(base+'/api/lab/overview',{headers:{host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(badHost,403);
  const overview=await (await fetch(base+'/api/lab/overview')).json();const app=overview.applications.find(a=>a.versions.length);const body=JSON.stringify({product:app.id,version:app.versions[0].version});
  for(const headers of [{},{origin:'https://evil.invalid','x-cro-lab-token':overview.token},{origin:base,'x-cro-lab-token':'wrong'}])assert.equal((await fetch(base+'/api/lab/instances',{method:'POST',headers:{...headers,'content-type':'application/json'},body})).status,403);
  const valid=await fetch(base+'/api/lab/instances',{method:'POST',headers:{origin:base,'x-cro-lab-token':overview.token,'content-type':'application/json'},body});assert.equal(valid.status,200);assert.equal((await valid.json()).state,'planned');
  const html=await (await fetch(base+'/')).text();assert.ok(html.includes('data-view="lab"'));assert.equal((await fetch(base+'/lab.js')).status,200);
});
