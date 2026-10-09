import {SiteAuthGuard} from '../../src/core/site-auth-guard.js';
// Purpose-built SIT only. No browser traces, screenshots, URL or token logging.
import {readFile,writeFile,open,unlink} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {createRequire} from 'node:module';
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MailpitReader} from '../../src/lab/mailpit.js';
import {writeJsonAtomic} from '../../src/storage/secure-json-store.js';
import {keycloakMailLink} from '../../src/interventions/keycloak-mail-link.js';
const [root,pair='current']=process.argv.slice(2);
if(!root||!isAbsolute(root)||!['current','previous'].includes(pair))throw new Error('Invalid scope');
process.env.PLAYWRIGHT_BROWSERS_PATH=join(root,'browsers');
const {chromium}=createRequire(join(root,'browser-runtime','package.json'))('playwright');
const authGuard=new SiteAuthGuard(process.env.CRO_AUTH_GUARD_DIR);
const origin=`http://127.0.0.1:${pair==='current'?18251:18261}`;
const mailOrigin=`http://127.0.0.1:${pair==='current'?18250:18260}`;
const lockPath=join(root,`email-browser-${pair}.lock`),lock=await open(lockPath,'wx',0o600);
const runId=Date.now();
const report={pair,startedAt:new Date().toISOString(),phase:'fixture',linkValidated:false,passwordChanged:false,newPasswordLogin:false,oldPasswordRejected:false,reusedLinkRejected:false,vaultUpdated:false};
let browser,account,journal;
async function persist(){await writeFile(join(root,`email-browser-${pair}-${runId}.json`),JSON.stringify(report,null,2),{mode:0o600});}
async function context(){const c=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});await c.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin?route.continue():route.abort();});c.setDefaultTimeout(12000);return c;}
try{
  const fixture=spawnSync(process.execPath,[fileURLToPath(new URL('./qualify.mjs',import.meta.url)),root,pair],{encoding:'utf8',timeout:90000,maxBuffer:100000});
  if(fixture.status!==0)throw new Error('Fixture failed');
  const qualified=JSON.parse(fixture.stdout.trim());
  account=JSON.parse(await readFile(join(root,`test-account-${pair}-${qualified.realm}.json`),'utf8'));
  report.realm=account.realm;
  const reader=new MailpitReader(mailOrigin);const matches=(await reader.messages()).filter(m=>m.From?.Address==='validation@example.invalid'&&m.To?.some(t=>t.Address===account.recipient)&&Date.parse(m.Created)>=Date.parse(qualified.startedAt));
  if(matches.length!==1||! /^[a-zA-Z0-9-]+$/.test(matches[0].ID))throw new Error('Mail correlation failed');
  report.phase='mail-link';
  // Reading this SIT API marks the selected message read. Never request latest.
  const message=await reader.get('/api/v1/message/'+encodeURIComponent(matches[0].ID));
  const link=keycloakMailLink(message.Text,{origin,realm:account.realm});report.linkValidated=true;
  browser=await chromium.launch({headless:true});report.browserVersion=browser.version();
  const c=await context(),page=await c.newPage();
  report.phase='action-page';await page.goto(link,{waitUntil:'domcontentloaded'});
  // Keycloak may first ask to confirm the required action.
  if(await page.locator('#kc-passwd-update-form').count()===0){const proceed=page.getByRole('link',{name:/click here to proceed/i});if(await proceed.count())await proceed.click();}
  await page.locator('#password-new').waitFor();
  const newPassword=randomBytes(32).toString('base64url')+'aA1!';
  journal=join(root,`pending-email-${pair}-${account.realm}.json`);
  await writeFile(journal,JSON.stringify({realm:account.realm,userId:account.userId,oldPassword:account.password,newPassword,state:'prepared'}),{flag:'wx',mode:0o600});
  report.phase='password-submit';await persist();
  report.phase='fill-new-password';await page.locator('#password-new').fill(newPassword);await page.locator('#password-confirm').fill(newPassword);
  report.phase='submit-button';
  await page.locator('#kc-passwd-update-form').locator('button[type=submit]').click();
  report.phase='confirmation-page';await page.locator('#kc-info-message').waitFor();
  report.passwordSubmitted=true;await c.close();
  async function login(password,expected){
    return authGuard.attempt(origin,async()=>{await loginOnce(password,expected);return true;});
  }
  async function loginOnce(password,expected){
    const ctx=await context(),p=await ctx.newPage();
    try{
      const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
      const callback=origin+'/realms/'+account.realm+'/account/';const state=randomBytes(16).toString('hex');let code;
      await ctx.route(callback+'**',async route=>{const u=new URL(route.request().url());if(u.searchParams.get('state')===state)code=u.searchParams.get('code');await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>CRO SIT callback</title>Callback received'});});
      const q=new URLSearchParams({client_id:'cro-sit-test',redirect_uri:callback,response_type:'code',scope:'openid',state,code_challenge:challenge,code_challenge_method:'S256'});
      await p.goto(origin+'/realms/'+account.realm+'/protocol/openid-connect/auth?'+q,{waitUntil:'domcontentloaded'});
      await p.locator('#username').fill(account.username);await p.locator('#password').fill(password);await p.locator('#kc-login').click();
      if(expected){await p.waitForURL(u=>u.pathname===new URL(callback).pathname&&u.searchParams.has('code'));const returned=new URL(p.url());if(returned.origin!==origin||returned.searchParams.get('state')!==state)throw new Error('Missing callback');code=returned.searchParams.get('code');if(!code)throw new Error('Missing callback');const r=await fetch(origin+'/realms/'+account.realm+'/protocol/openid-connect/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),body:new URLSearchParams({grant_type:'authorization_code',client_id:'cro-sit-test',code,code_verifier:verifier,redirect_uri:callback})});const payload=await r.json();report.codeExchangeStatus=r.status;if(['invalid_grant','invalid_client','invalid_request','unauthorized_client'].includes(payload.error))report.codeExchangeError=payload.error;if(!r.ok||!payload.access_token)throw new Error('Code exchange failed');}
      else {await p.locator('#input-error-username').waitFor();if(code)throw new Error('Old password accepted');}
    }catch(e){report.loginElementIds=await p.locator('[id]').evaluateAll(nodes=>nodes.map(n=>n.id));throw e;}finally{await ctx.close();}
  }
  report.phase='fresh-login';await login(newPassword,true);report.newPasswordLogin=true;
  report.oldPasswordRejectionTested=false;report.passwordChanged=true;
  report.phase='reused-link';const retry=await context(),p=await retry.newPage();await p.goto(link,{waitUntil:'domcontentloaded'});await p.locator('#kc-error-message').waitFor();if(await p.locator('#password-new').count())throw new Error('Link reusable');report.reusedLinkRejected=true;await retry.close();
  report.phase='expired-link';
  const bootstrap=JSON.parse(await readFile(join(root,'bootstrap-private.json'),'utf8'));
  let auth;
  await authGuard.attempt(origin,async()=>{const authResponse=await fetch(origin+'/realms/master/protocol/openid-connect/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'cro-bootstrap',password:bootstrap[pair]})});
  if(!authResponse.ok)return false;auth=await authResponse.json();return Boolean(auth.access_token);});
  const before=new Set((await reader.messages()).map(m=>m.ID));
  const sent=await fetch(origin+'/admin/realms/'+account.realm+'/users/'+account.userId+'/execute-actions-email?lifespan=1',{method:'PUT',redirect:'error',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+auth.access_token,'content-type':'application/json'},body:JSON.stringify(['UPDATE_PASSWORD'])});
  if(sent.status!==204)throw new Error('Expiry preparation failed');
  let expiredMessage;
  for(let n=0;n<10;n++){const found=(await reader.messages()).filter(m=>!before.has(m.ID)&&m.From?.Address==='validation@example.invalid'&&m.To?.some(t=>t.Address===account.recipient));if(found.length>1)throw new Error('Ambiguous expiry email');if(found.length===1){expiredMessage=found[0];break;}await new Promise(r=>setTimeout(r,300));}
  if(!expiredMessage||! /^[a-zA-Z0-9-]+$/.test(expiredMessage.ID))throw new Error('Expiry mail missing');
  const expiredBody=await reader.get('/api/v1/message/'+encodeURIComponent(expiredMessage.ID));
  const expiredLink=keycloakMailLink(expiredBody.Text,{origin,realm:account.realm});
  await new Promise(r=>setTimeout(r,3100));
  const expiredContext=await context(),expiredPage=await expiredContext.newPage();await expiredPage.goto(expiredLink,{waitUntil:'domcontentloaded'});await expiredPage.locator('#kc-error-message').waitFor();if(await expiredPage.locator('#password-new').count())throw new Error('Expired link accepted');report.expiredLinkRejected=true;await expiredContext.close();
  report.phase='post-expiry-login';await login(newPassword,true);report.passwordRetainedAfterExpiry=true;
  // This is a SIT recovery journal, not a vault update.
  await writeJsonAtomic(journal,{realm:account.realm,userId:account.userId,newPassword,state:'site-verified-vault-not-connected'});
  report.phase='complete';report.completedAt=new Date().toISOString();
}catch(e){
  report.failed=true;report.errorClass=e.constructor.name;
  if(['Missing callback','Code exchange failed','Old password accepted','Link reusable','Fixture failed','Unexpected mail link'].includes(e.message))report.failureReason=e.message;process.exitCode=1;
  report.pageStructure=[];
  if(browser)for(const c of browser.contexts())for(const p of c.pages())try{report.pageStructure.push(await p.locator('input,button,form,[role=alert]').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,id:n.id,type:n.getAttribute('type'),name:n.getAttribute('name')}))));}catch{}
  report.recoveryProbe='disabled-by-site-authentication-policy';
}
finally{try{await browser?.close();}catch{report.cleanupFailed=true;process.exitCode=1;}await persist();await lock.close();await unlink(lockPath);console.log(JSON.stringify(report));}
