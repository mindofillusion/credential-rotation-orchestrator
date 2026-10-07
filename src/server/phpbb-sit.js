import { spawn } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyTemplateBundle } from '../core/template-verifier.js';

import { FORUM_SIT } from '../core/sit-origins.js';
const policy = { allowForumSitLoopback: true };
const exists = file => access(file).then(()=>true,()=>false);
export class PhpbbSitController {
  constructor({ directory, sourceRoot, events, engine = 'phpbb', runtimeDirectory = directory }) {
    if(!Object.hasOwn(FORUM_SIT,engine))throw new Error('Unknown fixture');
    this.engine=engine;this.origin=FORUM_SIT[engine].origin;this.runtimeDirectory=runtimeDirectory;
    this.directory=directory;this.sourceRoot=sourceRoot;this.events=events;this.running=false;
  }
  async state() {
    let account=null,lastResult=null;
    try {
      const s=JSON.parse(await readFile(join(this.directory,'forum-secrets.json'),'utf8'));
      account={id:`${this.engine}-sit`,username:s.username,origin:this.origin,site:`${FORUM_SIT[this.engine].name} SIT`};
    } catch {}
    try {
      const r=JSON.parse(await readFile(join(this.directory,'rotation-result.json'),'utf8'));
      lastResult=Object.fromEntries(['status','remoteChanged','vaultUpdated','completedAt','templateId','templateVersion','templateDigest','newPasswordLogin','oldPasswordRejected','vaultReadbackLogin'].filter(k=>k in r).map(k=>[k,r[k]]));
    } catch {}
    return {enabled:true,engine:this.engine,name:FORUM_SIT[this.engine].name,origin:this.origin,account,running:this.running || await exists(join(this.directory,'rotation.lock')),recoveryPending:await exists(join(this.directory,'rotation-pending.json')),lastResult};
  }
  async run(bundle,keys) {
    if(this.running)throw new Error('Une rotation est déjà en cours.');
    const verified=verifyTemplateBundle(bundle,keys,new Date(),policy);
    if(verified.manifest.allowedOrigins.length!==1 || verified.manifest.allowedOrigins[0]!==this.origin)throw new Error('Ce parcours ne cible pas le forum SIT.');
    this.running=true;
    try {
      const state=await this.state();
      if(state.recoveryPending)throw new Error('Une récupération est en attente : nouvelle rotation bloquée.');
      if(!state.account)throw new Error('Le compte de test est absent.');
      this.events.emit('credential.rotation.started',`account/${this.engine}-sit`,{template:verified.id,site:this.origin});
      const trustedKeys=[...keys].map(([id,key])=>[id,typeof key==='string'?key:key.export({type:'spki',format:'pem'})]);
      const code=await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,[join(this.sourceRoot,'sit/forums/rotation-runner.mjs')],{
          cwd:this.directory,stdio:['pipe','ignore','ignore'],
          env:{PATH:process.env.PATH,HOME:process.env.HOME,
            CRO_FORUM_ENGINE:this.engine,CRO_FORUM_SIT_DIR:this.directory,CRO_BROWSER_RUNTIME_DIR:this.runtimeDirectory,CRO_SIT_ACCESS_DIR:process.env.CRO_SIT_ACCESS_DIR,
            CRO_SIT_SSH_HOST:process.env.CRO_SIT_SSH_HOST,
            PLAYWRIGHT_BROWSERS_PATH:join(this.runtimeDirectory,'browsers'),
            LD_LIBRARY_PATH:join(this.runtimeDirectory,'runtime/usr/lib/x86_64-linux-gnu')}
        });
        const timer=setTimeout(()=>child.kill('SIGTERM'),120000);
        child.once('error',()=>{clearTimeout(timer);reject(new Error('Le processus de rotation n’a pas démarré.'));});
        child.once('close',code=>{clearTimeout(timer);resolve(code);});
        child.stdin.on('error',()=>{});
        child.stdin.end(JSON.stringify({bundle,trustedKeys}));
      });
      const after=await this.state();
      if(code!==0 || after.recoveryPending || after.lastResult?.status!=='succeeded' || after.lastResult?.templateDigest!==verified.digest) {
        const status=after.recoveryPending?'ambiguous':'failed';
        this.events.emit(`credential.rotation.${status==='ambiguous'?'state_ambiguous':'failed'}`,`account/${this.engine}-sit`,{site:this.origin});
        return {status,recoveryPending:after.recoveryPending};
      }
      this.events.emit('credential.rotation.succeeded',`account/${this.engine}-sit`,{site:this.origin,template:verified.id});
      return {...after.lastResult,recoveryPending:false};
    } finally {this.running=false;}
  }
}
