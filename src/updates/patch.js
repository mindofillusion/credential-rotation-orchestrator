import {createHash,verify} from 'node:crypto';
import {canonicalJson} from '../core/canonical-json.js';
export function verifyPatch(patch,{publicKey,currentVersion,now=Date.now()}){
 const m=patch?.manifest;
 if(!publicKey)throw new Error('Aucune autorité de mise à jour configurée');
 if(!m||m.format!=='cro-patch-v1'||m.application!=='credential-rotation-orchestrator')throw new Error('Format CRO invalide');
 if(!verify(null,Buffer.from(canonicalJson(m)),publicKey,Buffer.from(patch.signature||'','base64')))throw new Error('Signature invalide');
 const version=v=>{if(!/^\d+\.\d+\.\d+$/.test(v))throw new Error('Version invalide');return v.split('.').map(Number)};
 const a=version(m.version),b=version(currentVersion);const first=a.findIndex((n,i)=>n!==b[i]);
 if(first<0||a[first]<b[first]||!Array.isArray(m.allowedFrom)||!m.allowedFrom.includes(currentVersion))throw new Error('Version source incompatible ou rétrogradation');
 if(!Number.isFinite(Date.parse(m.expiresAt))||Date.parse(m.expiresAt)<=now)throw new Error('Paquet expiré');
 if(!Array.isArray(m.files)||m.files.length<3||m.files.length>300||!patch.files||typeof patch.files!=='object')throw new Error('Liste de fichiers invalide');
 const names=new Set();const files=[];let size=0;
 for(const f of m.files){
  const p=f.path;
  if(typeof p!=='string'||p.length>180||! /^(?:(?:bin|src|public|docs|sit)\/[a-zA-Z0-9_./-]+|package.json|README.md|LICENSE|SECURITY.md)$/.test(p)||p.split('/').some(x=>!x||x==='.'||x==='..'||x.endsWith('.'))||names.has(p.toLowerCase()))throw new Error('Chemin de fichier interdit ou dupliqué');
  names.add(p.toLowerCase());
  const encoded=patch.files[p];if(typeof encoded!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw new Error('Charge utile invalide');
  const data=Buffer.from(encoded,'base64');size+=data.length;
  if(size>2*1024*1024||createHash('sha256').update(data).digest('hex')!==f.sha256)throw new Error('Empreinte ou taille incorrecte');
  files.push({path:p,data});
 }
 if(Object.keys(patch.files).length!==m.files.length)throw new Error('Fichiers supplémentaires');
 const pkg=JSON.parse(files.find(f=>f.path==='package.json')?.data.toString()||'null');
 if(pkg?.name!==m.application||pkg.version!==m.version||!files.some(f=>f.path==='bin/cro.js')||!files.some(f=>f.path==='src/server/main.js'))throw new Error('Application incomplète');
 if(Object.keys(pkg.dependencies||{}).length||Object.keys(pkg.optionalDependencies||{}).length)throw new Error('Dépendances externes non prises en charge');
 return {manifest:m,files};
}
