import {randomUUID, createHash} from 'node:crypto';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {readJsonFile,writeJsonAtomic} from '../storage/secure-json-store.js';
import {MailpitReader} from './mailpit.js';
const digest = value => createHash('sha256').update(value).digest('hex');
const ACTIVE=new Set(['awaiting_email','awaiting_user','ready_to_verify','ambiguous']);
function text(value,max=160){if(typeof value!=='string'||!value.trim()||value.length>max||/[\r\n\0]/.test(value))throw new Error('Champ invalide');return value.trim();}
function email(value){value=text(value,254).toLowerCase();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))throw new Error('Adresse invalide');return value;}
function exact(body,names){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!names.includes(k)))throw new Error('Champs inattendus');}
export class LabService {
  constructor({dataDirectory,sourceRoot,mailpit,clock=()=>Date.now()}){
    this.path=join(dataDirectory,'lab','state.json');this.sourceRoot=sourceRoot;this.clock=clock;
    this.mailpit=mailpit||new MailpitReader(process.env.CRO_LAB_MAILPIT_URL);this.queue=Promise.resolve();
  }
  async initialize(){
    this.catalogue=JSON.parse(await readFile(join(this.sourceRoot,'sit/catalogue/catalogue.json'),'utf8'));
    this.state=await readJsonFile(this.path,{schemaVersion:1,instances:[],checkpoints:[],events:[]});
    if(this.state.schemaVersion!==1||!Array.isArray(this.state.instances)||!Array.isArray(this.state.checkpoints)||!Array.isArray(this.state.events))throw new Error('État Laboratoire incompatible');
  }
  transact(fn){const task=this.queue.then(async()=>{const before=structuredClone(this.state);try{const result=await fn();await writeJsonAtomic(this.path,this.state);return result;}catch(e){this.state=before;throw e;}});this.queue=task.catch(()=>{});return task;}
  record(type,id){const e={id:randomUUID(),type,subject:`lab/${id}`,time:new Date(this.clock()).toISOString()};this.state.events.unshift(e);this.state.events=this.state.events.slice(0,250);}
  publicCheckpoint(c){return {id:c.id,instanceId:c.instanceId,mode:c.mode,state:c.state,createdAt:c.createdAt,expiresAt:c.expiresAt,matchedMessages:c.messageHashes.length,rotationVerified:false,vaultUpdated:false};}
  async overview(){await this.queue;return {catalogueVersion:this.catalogue.catalogue_version,summary:this.catalogue.summary,
    applications:this.catalogue.applications.map(a=>({id:a.id,name:a.name,family:a.family,priority:a.priority,versions:a.versions.map(v=>({version:v.version,quarantine:v.quarantine,state:v.state})),installationStatus:a.installation_status,adoption:a.adoption_status})),
    instances:structuredClone(this.state.instances),checkpoints:this.state.checkpoints.map(c=>this.publicCheckpoint(c)),events:structuredClone(this.state.events),mailpit:await this.mailpit.status(),
    capabilities:{plan:true,observeEmail:true,install:false,start:false,rotate:false},
    scope:'local-lab-planning-and-email-observation'};}
  async createInstance(body){return this.transact(async()=>{
    exact(body,['product','version']);const a=this.catalogue.applications.find(a=>a.id===body.product);const v=a?.versions.find(v=>v.version===body.version);
    if(!a||!v)throw new Error('Version absente du catalogue');
    const existing=this.state.instances.find(i=>i.product===a.id&&i.version===v.version);if(existing)return existing;
    if(this.state.instances.length>=500)throw new Error('Limite locale des plans atteinte');
    const i={id:randomUUID(),product:a.id,name:a.name,version:v.version,state:'planned',quarantine:v.quarantine,createdAt:new Date(this.clock()).toISOString(),qualified:false};
    this.state.instances.push(i);this.record('lab.instance.planned',i.id);return structuredClone(i);
  });}
  async createCheckpoint(body){return this.transact(async()=>{
    exact(body,['instanceId','recipient','sender','subject','mode','timeoutMinutes']);
    if(!this.state.instances.some(i=>i.id===body.instanceId))throw new Error('Instance inconnue');
    if(!['mailpit','manual'].includes(body.mode))throw new Error('Mode inconnu');
    const recipient=email(body.recipient);const sender=body.mode==='mailpit'?email(body.sender):null;
    const subject=body.mode==='mailpit'?text(body.subject,200):null;
    // No mail domains are imposed on manual approvals. Mailpit holds test mail only.
    const minutes=body.timeoutMinutes??15;if(!Number.isInteger(minutes)||minutes<1||minutes>60)throw new Error('Délai de 1 à 60 minutes requis');
    if(this.state.checkpoints.some(c=>c.instanceId===body.instanceId&&c.recipient===recipient&&ACTIVE.has(c.state)))throw new Error('Une attente ou réconciliation existe déjà pour ce compte');
    if(this.state.checkpoints.length>=1000)throw new Error('Limite locale des attentes atteinte');
    let baseline=[];
    if(body.mode==='mailpit')baseline=(await this.mailpit.messages()).map(m=>digest(String(m.ID)));
    const now=this.clock();const c={id:randomUUID(),instanceId:body.instanceId,recipient,sender,subject,mode:body.mode,state:body.mode==='manual'?'awaiting_user':'awaiting_email',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+minutes*60000).toISOString(),baseline,messageHashes:[]};
    this.state.checkpoints.push(c);this.record('lab.validation.waiting',c.id);return this.publicCheckpoint(c);
  });}
  async inspect(id){return this.transact(async()=>{
    const c=this.state.checkpoints.find(c=>c.id===id);if(!c)throw new Error('Attente inconnue');
    if(!['awaiting_email','awaiting_user'].includes(c.state))return this.publicCheckpoint(c);
    if(this.clock()>=Date.parse(c.expiresAt)){c.state='expired';this.record('lab.validation.expired',c.id);return this.publicCheckpoint(c);}
    if(c.mode==='manual')return this.publicCheckpoint(c);
    const messages=await this.mailpit.messages();const matches=new Set();
    for(const m of messages){
      if(typeof m.ID!=='string'||!m.ID)continue;
      const hash=digest(m.ID);const received=Date.parse(m.Created);
      if(c.baseline.includes(hash)||!Number.isFinite(received)||received<Date.parse(c.createdAt)||received>this.clock()||received>=Date.parse(c.expiresAt))continue;
      if(String(m.From?.Address||'').toLowerCase()!==c.sender||m.Subject!==c.subject)continue;
      if(!Array.isArray(m.To)||!m.To.some(t=>String(t.Address||'').toLowerCase()===c.recipient))continue;
      matches.add(hash);
    }
    c.messageHashes=[...matches];
    if(matches.size){c.state=matches.size===1?'ready_to_verify':'ambiguous';this.record(matches.size===1?'lab.validation.email_observed':'lab.validation.ambiguous',c.id);}
    return this.publicCheckpoint(c);
  });}
  async close(body){return this.transact(async()=>{
    exact(body,['id']);const c=this.state.checkpoints.find(c=>c.id===body.id);if(!c)throw new Error('Attente inconnue');
    if(c.state!=='closed_unverified'){c.state='closed_unverified';this.record('lab.validation.closed_unverified',c.id);}
    return this.publicCheckpoint(c);
  });}
  async acknowledge(body){return this.transact(async()=>{
    exact(body,['id']);const c=this.state.checkpoints.find(c=>c.id===body.id);if(!c||c.mode!=='manual'||c.state!=='awaiting_user')throw new Error('Validation humaine non attendue');
    if(this.clock()>=Date.parse(c.expiresAt)){c.state='expired';this.record('lab.validation.expired',c.id);return this.publicCheckpoint(c);}
    c.state='ready_to_verify';this.record('lab.validation.user_acknowledged',c.id);return this.publicCheckpoint(c);
  });}
}
