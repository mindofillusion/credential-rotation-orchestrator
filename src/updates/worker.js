import {readFile,writeFile,rename,unlink,open} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
const [root,jobPath]=process.argv.slice(2);const job=JSON.parse(await readFile(jobPath,'utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function pointer(value){const p=join(root,'current.json');await writeFile(p+'.tmp',JSON.stringify(value),{mode:0o600});await rename(p+'.tmp',p);}
async function health(){try{return await (await fetch(`http://${job.host}:${job.port}/api/health`,{signal:AbortSignal.timeout(500)})).json();}catch{return null;}}
async function start(config){const fd=await open(join(root,'update-runtime.log'),'a',0o600);const child=spawn(process.execPath,[join(config.sourceRoot,'bin/cro.js'),'--port',String(job.port),'--host',job.host,'--data-dir',job.dataDirectory],{detached:true,windowsHide:true,stdio:['ignore',fd.fd,fd.fd],env:{...process.env,CRO_INSTALL_ROOT:root}});child.on('error',()=>{});child.unref();await fd.close();return child;}
let result;let candidate;
try{
 for(let n=0;n<100;n++){if(!await health())break;if(n===99)throw new Error('Ancienne instance toujours active');await sleep(100);}
 await pointer(job.next);candidate=await start(job.next);
 let good=false;for(let n=0;n<60;n++){await sleep(250);const h=await health();if(h?.application==='credential-rotation-orchestrator'&&h.version===job.next.version){good=true;break;}}
 if(!good)throw new Error('Contrôle de santé du candidat échoué');
 result={status:'succeeded',version:job.next.version,previousVersion:job.previous.version};
}catch{
 if(candidate?.pid){try{process.kill(candidate.pid);}catch{}await sleep(700);}
 await pointer(job.previous);if(!await health())await start(job.previous);
 let healthy=false;for(let n=0;n<40;n++){await sleep(250);if((await health())?.version===job.previous.version){healthy=true;break;}}
 result={status:healthy?'rolled_back':'rollback_failed',version:job.previous.version};
}finally{await writeFile(join(root,'last-update.json'),JSON.stringify({...result,at:new Date().toISOString()}),{mode:0o600});await unlink(jobPath);}
