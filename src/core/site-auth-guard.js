import {mkdir,lstat,open,unlink} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {createHash} from 'node:crypto';

export function authenticationSite(url){
  const u=new URL(url);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Invalid authentication site');
  // Scheme, port, path, account and template never create a fresh allowance.
  return u.hostname.toLowerCase().replace(/\.$/,'');
}
export class SiteAuthGuard {
  constructor(directory){if(!directory||!isAbsolute(directory))throw new Error('Shared authentication guard directory required');this.directory=directory;}
  async attempt(url,authenticate){
    const site=authenticationSite(url);
    await mkdir(this.directory,{recursive:true,mode:0o700});
    const st=await lstat(this.directory);
    if(!st.isDirectory()||st.isSymbolicLink()||(process.platform!=='win32'&&(st.mode&0o077)))throw new Error('Unsafe authentication guard directory');
    const file=join(this.directory,createHash('sha256').update(site).digest('hex')+'.blocked');
    let h;
    try{h=await open(file,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw new Error('site_authentication_locked');throw e;}
    // Reserve durably BEFORE any request. A crash, rejection or uncertain result leaves the lock.
    try{await h.writeFile(JSON.stringify({version:1,createdAt:new Date().toISOString(),reason:'authentication_not_confirmed'}));await h.sync();}finally{await h.close();}
    if(process.platform!=='win32'){const d=await open(this.directory,'r');try{await d.sync();}finally{await d.close();}}
    const accepted=await authenticate();
    if(accepted!==true)throw new Error('site_authentication_rejected');
    await unlink(file);
    return true;
  }
}
