import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {MailpitReader} from '../../src/lab/mailpit.js';
const [root,pair='current']=process.argv.slice(2);
if(!root||!isAbsolute(root)||!['current','previous'].includes(pair))throw new Error('Explicit private root and fixed pair required');
const reports=(await readdir(root)).filter(n=>new RegExp(`^qualification-${pair}-[0-9]+[.]json$`).test(n)).sort().reverse();
let previous;for(const file of reports){const r=JSON.parse(await readFile(join(root,file),'utf8'));if(r.emailCaptured){previous=r;break;}}
if(!previous)throw new Error('No successful report');
const port=pair==='current'?18251:18261;let realmRetained=false;
for(let n=0;n<45;n++){try{const response=await fetch(`http://127.0.0.1:${port}/realms/${previous.realm}/.well-known/openid-configuration`,{signal:AbortSignal.timeout(1500)});if(response.ok){realmRetained=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
const reader=new MailpitReader(`http://127.0.0.1:${port-1}`);
const mailRetained=(await reader.messages()).some(m=>m.To?.some(t=>t.Address===previous.realm+'@example.invalid'));
const result={pair,checkedAt:new Date().toISOString(),realmRetained,mailRetained};
await writeFile(join(root,`restart-${pair}-${Date.now()}.json`),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));if(!realmRetained||!mailRetained)process.exitCode=1;
