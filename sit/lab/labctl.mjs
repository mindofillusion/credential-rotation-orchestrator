// Fixed, isolated SIT recipe. Never accepts arbitrary Docker arguments.
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const [action,root,pair='current']=process.argv.slice(2);
if(!['install','start','stop','status'].includes(action)||!root||!isAbsolute(root)||!['current','previous'].includes(pair))throw new Error('Usage: node labctl.mjs install|start|stop|status ABSOLUTE_PRIVATE_ROOT [current|previous]');
const source=new URL('./recipe-compose.json',import.meta.url);
const secretPath=join(root,'bootstrap-private.json');
await mkdir(root,{recursive:true,mode:0o700});
if((await lstat(root)).isSymbolicLink())throw new Error('Symbolic root refused');
// On Windows provision the root ACL for the current user before invoking.
if(process.platform!=='win32'&&((await lstat(root)).mode&0o077))throw new Error('Private root permissions required');
if(action==='install'){
  for(const args of [['ps','-aq'],['network','ls','-q'],['volume','ls','-q']]){
    const r=spawnSync('docker',[...args,'--filter','label=com.docker.compose.project=cro-catalogue-lab'],{encoding:'utf8'});
    if(r.status!==0||r.stdout.trim())throw new Error('Project already exists or Docker unavailable; refusing installation');
  }
  const secrets={current:randomBytes(32).toString('hex'),previous:randomBytes(32).toString('hex')};
  await writeFile(secretPath,JSON.stringify(secrets),{flag:'wx',mode:0o600});
  await writeFile(join(root,'compose.json'),await readFile(source),{flag:'wx',mode:0o600});
  if(resolve(root)!==resolve(fileURLToPath(new URL('.',import.meta.url))))await writeFile(join(root,'gateway.mjs'),await readFile(new URL('./gateway.mjs',import.meta.url)),{flag:'wx',mode:0o600});
}
const secrets=JSON.parse(await readFile(secretPath,'utf8'));
const env={...process.env,CRO_LAB_KC_CURRENT_PASSWORD:secrets.current,CRO_LAB_KC_PREVIOUS_PASSWORD:secrets.previous};
const base=['compose','--project-name','cro-catalogue-lab','--file',join(root,'compose.json')];
function docker(args){const r=spawnSync('docker',[...base,...args],{env,stdio:'inherit'});if(r.status!==0)throw new Error(`Docker operation failed (${r.status}); retained diagnostics and data`);}
if(action==='install')docker(['create','--pull','never']);
if(action==='start')docker(['up','-d','--pull','never',`gateway-${pair}`]);
if(action==='stop')docker(['stop',`gateway-${pair}`,`identity-${pair}`,`mail-${pair}`]);
if(action==='status')docker(['ps','--all']);
