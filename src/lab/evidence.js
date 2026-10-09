import {readdir,readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
// Read fixed test-report names only. Never expose credentials, messages or URLs.
export async function readLabEvidence(root){
  if(!root)return {available:false,pairs:[]};
  try{
    const stat=await lstat(root);if(!stat.isDirectory()||stat.isSymbolicLink())return {available:false,pairs:[]};
    const names=(await readdir(root)).filter(n=>/^email-browser-(current|previous)-[0-9]{13}[.]json$/.test(n)).sort().reverse();
    const pairs=[];
    for(const pair of ['current','previous']){
      const file=names.find(n=>n.startsWith(`email-browser-${pair}-`));if(!file)continue;
      const p=join(root,file),s=await lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.size>32768)continue;
      let data;try{data=JSON.parse(await readFile(p,'utf8'));}catch{continue;}
      const checks={};for(const key of ['linkValidated','passwordChanged','newPasswordLogin','oldPasswordRejected','reusedLinkRejected','expiredLinkRejected','passwordRetainedAfterExpiry'])checks[key]=data[key]===true;
      const siteVerified=data.phase==='complete'&&!data.failed&&Object.entries(checks).filter(([k])=>k!=='oldPasswordRejected').every(([,v])=>v);
      checks.oldPasswordRejectionTested=data.oldPasswordRejectionTested===false?false:checks.oldPasswordRejected;
      pairs.push({pair,siteVerified,checks,vaultVerified:false,recordedAt:Number.isFinite(Date.parse(data.completedAt||data.startedAt))?new Date(data.completedAt||data.startedAt).toISOString():null});
    }
    return {available:true,pairs,scope:'historical-local-test-reports-not-live-health'};
  }catch{return {available:false,pairs:[]};}
}
