import {SiteAuthGuard} from '../../src/core/site-auth-guard.js';
// Real Keycloak -> SMTP -> Mailpit test; no tokens or message bodies in reports.
import {readFile,writeFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {randomBytes} from 'node:crypto';
import {MailpitReader} from '../../src/lab/mailpit.js';
const [root,pair='current']=process.argv.slice(2);
if(!root||!isAbsolute(root)||!['current','previous'].includes(pair))throw new Error('Explicit private root and fixed pair required');
const port=pair==='current'?18251:18261;const mailPort=port-1;
const origin=`http://127.0.0.1:${port}`,mailOrigin=`http://127.0.0.1:${mailPort}`;
const authGuard=new SiteAuthGuard(process.env.CRO_AUTH_GUARD_DIR);
const secrets=JSON.parse(await readFile(join(root,'bootstrap-private.json'),'utf8'));
const report={pair,startedAt:new Date().toISOString(),discovery:false,adminLogin:false,testUserLogin:false,emailCaptured:false,readerCompatible:false,rotationVerified:false,vaultUpdated:false};
const realm='cro-sit-'+randomBytes(6).toString('hex');
report.realm=realm;
async function request(path,options={}){
  if(options.body instanceof URLSearchParams&&options.body.get('grant_type')==='password'){
    let response;await authGuard.attempt(origin,async()=>{response=await requestOnce(path,options);return Boolean((await response.clone().json()).access_token);});return response;
  }
  return requestOnce(path,options);
}
async function requestOnce(path,options={}){const response=await fetch(origin+path,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`HTTP ${response.status} on ${path.split('?')[0]}`);return response;}
try{
  let ready=false;for(let n=0;n<45;n++){try{const r=await fetch(origin+'/realms/master/.well-known/openid-configuration',{signal:AbortSignal.timeout(1500)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw new Error('Keycloak startup deadline');report.discovery=true;
  const auth=await (await request('/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'cro-bootstrap',password:secrets[pair]})})).json();report.adminLogin=true;
  const headers={authorization:`Bearer ${auth.access_token}`,'content-type':'application/json'};
  await request('/admin/realms',{method:'POST',headers,body:JSON.stringify({realm,enabled:true,sslRequired:'none',resetPasswordAllowed:true,smtpServer:{host:`mail-${pair}`,port:'1025',from:'validation@example.invalid',auth:'false',ssl:'false',starttls:'false'}})});
  await request(`/admin/realms/${realm}/clients`,{method:'POST',headers,body:JSON.stringify({clientId:'cro-sit-test',enabled:true,publicClient:true,directAccessGrantsEnabled:true,standardFlowEnabled:true,redirectUris:[origin+'/realms/'+realm+'/account/'],attributes:{'pkce.code.challenge.method':'S256'}})});
  const password=randomBytes(32).toString('hex'),recipient=realm+'@example.invalid';
  const created=await request(`/admin/realms/${realm}/users`,{method:'POST',headers,body:JSON.stringify({username:'cro-test',email:recipient,emailVerified:true,firstName:'CRO',lastName:'SIT',enabled:true,credentials:[{type:'password',value:password,temporary:false}]})});
  const userId=created.headers.get('location')?.split('/').pop();
  if(!userId||! /^[a-f0-9-]{36}$/.test(userId))throw new Error('Unexpected user location');
  await writeFile(join(root,`test-account-${pair}-${realm}.json`),JSON.stringify({realm,userId,username:'cro-test',password,recipient}),{flag:'wx',mode:0o600});
  const login=await (await request(`/realms/${realm}/protocol/openid-connect/token`,{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'cro-sit-test',username:'cro-test',password})})).json();if(!login.access_token)throw new Error('No test token');report.testUserLogin=true;
  const reader=new MailpitReader(mailOrigin);const baseline=new Set((await reader.messages()).map(m=>m.ID));
  await request(`/admin/realms/${realm}/users/${userId}/execute-actions-email?lifespan=120`,{method:'PUT',headers,body:JSON.stringify(['UPDATE_PASSWORD'])});
  for(let n=0;n<10;n++){const messages=await reader.messages();const matches=messages.filter(m=>!baseline.has(m.ID)&&m.From?.Address==='validation@example.invalid'&&m.To?.some(t=>t.Address===recipient));if(matches.length===1){report.emailCaptured=true;report.readerCompatible=true;break;}await new Promise(r=>setTimeout(r,500));}
  if(!report.emailCaptured)throw new Error('SMTP message not uniquely observed');
  report.realm=realm;report.completedAt=new Date().toISOString();

}catch(e){report.error=e.message;process.exitCode=1;}
await writeFile(join(root,`qualification-${pair}-${Date.now()}.json`),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
