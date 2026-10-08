import {mkdir,lstat,open,link,unlink,readFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {createHash,randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';

// The caller supplies a 32-byte key from its protected identity store.
// No key is generated, written or returned here. Windows root ACLs are caller-owned.
export class FileRecoveryStore {
  #key;
  constructor({directory,key}) {
    if(!isAbsolute(directory)||!Buffer.isBuffer(key)||key.length!==32)throw new Error('Invalid recovery configuration');
    this.directory=directory;this.#key=Buffer.from(key);
  }
  path(id){if(typeof id!=='string'||!id||id.length>512)throw new Error('Invalid account');return join(this.directory,createHash('sha256').update(id).digest('hex')+'.json');}
  async root(){await mkdir(this.directory,{recursive:true,mode:0o700});const s=await lstat(this.directory);if(!s.isDirectory()||s.isSymbolicLink()||(process.platform!=='win32'&&(s.mode&0o077)))throw new Error('Unsafe recovery directory');}
  async syncDirectory(){if(process.platform==='win32')return;const h=await open(this.directory,'r');try{await h.sync();}finally{await h.close();}}
  async withLock(id,operation){
    await this.root();const lock=this.path(id)+'.lock';let h;
    try{h=await open(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')return {status:'blocked',reason:'recovery_lock_present'};throw e;}
    try{await h.sync();await this.syncDirectory();return await operation();}
    finally{await h.close();await unlink(lock);await this.syncDirectory();}
  }
  async has(id){await this.root();try{await lstat(this.path(id));return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
  async put(id,password,context={}) {
    await this.root();const destination=this.path(id),temporary=destination+'.'+randomUUID()+'.tmp';
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.#key,iv);cipher.setAAD(Buffer.from(id));
    const plaintext=Buffer.from(JSON.stringify({password,context}));
    const data=Buffer.concat([cipher.update(plaintext),cipher.final()]);plaintext.fill(0);
    const envelope=JSON.stringify({format:1,iv:iv.toString('base64'),data:data.toString('base64'),tag:cipher.getAuthTag().toString('base64')});
    const h=await open(temporary,'wx',0o600);
    try{await h.writeFile(envelope);await h.sync();}finally{await h.close();}
    try{await link(temporary,destination);await this.syncDirectory();}finally{await unlink(temporary);}
  }
  async get(id){
    await this.root();const p=this.path(id),s=await lstat(p);
    if(!s.isFile()||s.isSymbolicLink()||s.size>65536||(process.platform!=='win32'&&(s.mode&0o077)))throw new Error('Unsafe recovery record');
    const e=JSON.parse(await readFile(p,'utf8'));if(e.format!==1)throw new Error('Unknown recovery format');
    const decipher=createDecipheriv('aes-256-gcm',this.#key,Buffer.from(e.iv,'base64'));decipher.setAAD(Buffer.from(id));decipher.setAuthTag(Buffer.from(e.tag,'base64'));
    const plaintext=Buffer.concat([decipher.update(Buffer.from(e.data,'base64')),decipher.final()]);
    try{return JSON.parse(plaintext.toString());}finally{plaintext.fill(0);}
  }
  async clear(id){await this.root();await unlink(this.path(id));await this.syncDirectory();}
}
