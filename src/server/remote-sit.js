import https from 'node:https';import tls from 'node:tls';import {readFile} from 'node:fs/promises';import {join} from 'node:path';import {sign,randomBytes,createHash} from 'node:crypto';
export async function remoteSitConfig(directory){if(!directory)return null;return JSON.parse(await readFile(join(directory,'connection.json'),'utf8'));}
export async function forwardSit(req,res,config,directory){
 const origin=req.headers.origin;if(req.method!=='GET'&&origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
 const endpoint=new URL(config.url);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search)throw new Error('Invalid paired endpoint');
 let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>1024*1024)throw new Error('Request too large');chunks.push(b);}const body=Buffer.concat(chunks);
 const ts=String(Date.now()),nonce=randomBytes(16).toString('hex');const message=[req.method,req.url,ts,nonce,createHash('sha256').update(body).digest('hex')].join('\n');
 const key=await readFile(join(directory,'client-key.pem'));const ca=await readFile(join(directory,'server-cert.pem'));
 const headers={'x-cro-time':ts,'x-cro-nonce':nonce,'x-cro-signature':sign(null,Buffer.from(message),key).toString('base64'),'content-length':body.length};if(req.headers['x-cro-sit-token'])headers['x-cro-sit-token']=req.headers['x-cro-sit-token'];
 const upstream=https.request(endpoint,{path:req.url,method:req.method,headers,ca,servername:config.serverName||endpoint.hostname,checkServerIdentity:(name,cert)=>tls.checkServerIdentity(name,cert)},r=>{res.writeHead(r.statusCode,{'content-type':r.headers['content-type']||'application/json','cache-control':'no-store'});r.pipe(res);});
 upstream.setTimeout(150000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json'});res.end('{"error":"Banc SIT inaccessible ou certificat non valide"}');});res.on('close',()=>upstream.destroy());upstream.end(body);
}
