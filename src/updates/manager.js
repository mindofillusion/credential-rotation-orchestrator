import {readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {join,dirname,resolve,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {verifyPatch} from './patch.js';
export class UpdateManager{
 constructor({root,version,sourceRoot,port,host,dataDirectory}){Object.assign(this,{root,version,sourceRoot,port,host,dataDirectory});this.busy=false;}
 async policy(){if(!this.root)throw new Error('Installation gérée non configurée');return readFile(join(this.root,'publisher.pem'),'utf8');}
 async check(patch){return verifyPatch(patch,{publicKey:await this.policy(),currentVersion:this.version});}
 async stage(patch){
  if(this.busy)throw new Error('Une installation est déjà en cours');this.busy=true;let stage;
  try{
   const checked=await this.check(patch);
   const current=JSON.parse(await readFile(join(this.root,'current.json'),'utf8'));
   if(resolve(current.sourceRoot)!==resolve(this.sourceRoot))throw new Error('Le lanceur ne correspond pas à cette instance');
   stage=join(this.root,'releases',checked.manifest.version+'-'+randomUUID());await mkdir(stage,{recursive:true,mode:0o700});
   for(const f of checked.files){const target=join(stage,f.path);await mkdir(dirname(target),{recursive:true,mode:0o700});await writeFile(target,f.data,{flag:'wx',mode:0o600});if(/\.(m?js)$/.test(f.path)){const r=spawnSync(process.execPath,['--check',target],{timeout:10000,windowsHide:true});if(r.status!==0)throw new Error('Syntaxe JavaScript invalide');}}
   await writeFile(join(stage,'verified-patch.json'),JSON.stringify({version:checked.manifest.version,verifiedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
   const job={previous:current,next:{sourceRoot:stage,version:checked.manifest.version},port:this.port,host:this.host,dataDirectory:this.dataDirectory};
   const jobPath=join(this.root,'update-job.json');await writeFile(jobPath,JSON.stringify(job),{flag:'wx',mode:0o600});
   return {version:checked.manifest.version,jobPath};
  }catch(e){this.busy=false;if(stage)await rm(stage,{recursive:true,force:true});throw e;}
 }
 launch(jobPath){const child=spawn(process.execPath,[join(this.sourceRoot,'src/updates/worker.js'),this.root,jobPath],{detached:true,windowsHide:true,stdio:'ignore',env:process.env});child.unref();return child;}
}
