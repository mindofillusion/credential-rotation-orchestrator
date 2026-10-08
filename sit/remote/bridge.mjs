// Explicitly paired HTTPS relay to one local CRO SIT backend. No arbitrary proxy target.
import https from 'node:https';import http from 'node:http';import {readFileSync} from 'node:fs';import {join} from 'node:path';import {verify,createHash} from 'node:crypto';
const dir=process.env.CRO_BRIDGE_DIR;if(!dir)throw new Error('CRO_BRIDGE_DIR required');
const conf=JSON.parse(readFileSync(join(dir,'config.json')));const publicKey=readFileSync(join(dir,'client-public.pem'));
const routes=new Set(['/api/overview','/api/templates','/api/templates/export','/api/templates/import','/api/templates/convert-codegen','/api/trust/keys','/api/events','/api/events/stream','/api/sit/phpbb/run','/api/sit/forums/run']);
const nonces=new Map();
https.createServer({key:readFileSync(join(dir,'tls-key.pem')),cert:readFileSync(join(dir,'tls-cert.pem')),minVersion:'TLSv1.2'},async(req,res)=>{
 const reject=()=>{res.writeHead(403,{'content-type':'application/json'});res.end('{"error":"Bridge request rejected"}');};
 try{
  if(!['GET','POST'].includes(req.method)||!routes.has(new URL(req.url,'https://localhost').pathname))return reject();
  const ts=req.headers['x-cro-time'],nonce=req.headers['x-cro-nonce'];const now=Date.now();
  for(const [k,t]of nonces)if(now-t>90000)nonces.delete(k);
  if(!/^\d{13}$/.test(ts||'')||Math.abs(now-Number(ts))>60000||! /^[a-f0-9]{32}$/.test(nonce||'')||nonces.has(nonce)||nonces.size>2000)return reject();
  let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>1024*1024)return reject();chunks.push(b);}const body=Buffer.concat(chunks);
  const message=[req.method,req.url,ts,nonce,createHash('sha256').update(body).digest('hex')].join('\n');
  if(!verify(null,Buffer.from(message),publicKey,Buffer.from(req.headers['x-cro-signature']||'','base64')))return reject();nonces.set(nonce,now);
  const headers={'host':'127.0.0.1:18787','origin':'http://127.0.0.1:18787','content-type':'application/json','content-length':body.length};
  if(req.headers['x-cro-sit-token'])headers['x-cro-sit-token']=req.headers['x-cro-sit-token'];
  const upstream=http.request({hostname:'127.0.0.1',port:18787,path:req.url,method:req.method,headers},r=>{res.writeHead(r.statusCode,{'content-type':r.headers['content-type']||'application/json','cache-control':'no-store'});r.pipe(res);});
  upstream.setTimeout(150000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on('close',()=>upstream.destroy());upstream.end(body);
 }catch{return reject();}
}).listen(conf.port,conf.host);
