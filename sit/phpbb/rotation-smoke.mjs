// Controlled, loopback-only phpBB integration test. No arbitrary templates or hosts.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RotationOrchestrator } from '../../src/core/rotation-orchestrator.js';
import { EventBus } from '../../src/core/event-bus.js';
import { api, encrypt, decrypt, connectExistingVault } from '../access/account-smoke.mjs';
const root = process.env.CRO_PHPBB_SIT_DIR;
if (!root?.startsWith('/')) throw new Error('Set CRO_PHPBB_SIT_DIR');
const {chromium} = createRequire(path.join(root,'package.json'))('playwright');
const origin = 'http://127.0.0.1:8224';
const secretsPath = path.join(root,'forum-secrets.json');
const journalPath = path.join(root,'rotation-pending.json');
const resultPath = path.join(root,'rotation-result.json');
process.umask(0o077);
function privateRead(file) {
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.mode & 0o077) throw new Error('Unsafe test credential file');
  return JSON.parse(fs.readFileSync(file));
}
function save(file,data) {fs.writeFileSync(file,JSON.stringify(data,null,2),{mode:0o600});}
let step='initialize';
let browser;
async function context() {
  const c = await browser.newContext({serviceWorkers:'block'});
  await c.route('**/*',route=>new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  return c;
}
async function login(c, username, password) {
  const page=await c.newPage();
  await page.goto(origin+'/ucp.php?mode=login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  // phpBB rejects a form submitted in the same second as its creation.
  await page.waitForTimeout(1500);
  await Promise.all([page.waitForNavigation(),page.locator('input[name="login"]').click()]);
  const accepted=await page.locator('a[href*="mode=logout"]').count()>0;
  return {page,accepted};
}
async function main() {
  if (fs.existsSync(journalPath)) throw new Error('Pending rotation requires reconciliation');
  const secret = privateRead(secretsPath);
  const {token,key} = connectExistingVault();
  const profile = api('GET','/api/accounts/profile',undefined,token);
  const enc=text=>encrypt(Buffer.from(text),key);
  if (!secret.cipherId) {
    step='create-vault-entry';
    const item=api('POST','/api/ciphers',{encryptedFor:profile.id,type:1,name:enc('CRO phpBB SIT'),notes:enc('Dedicated loopback-only test account'),login:{username:enc(secret.username),password:enc(secret.password),uris:[{uri:enc(origin),match:null}]},organizationId:null,folderId:null,favorite:false,reprompt:0},token);
    secret.cipherId=item.id;save(secretsPath,secret);
  }
  let original;
  const vault={
    async getCredential(id) {
      original=api('GET',`/api/ciphers/${id}`,undefined,token);
      return {username:decrypt(original.login.username,key).toString(),password:decrypt(original.login.password,key).toString()};
    },
    async updateCredential(id,password) {
      step='update-vault';
      const item={...original,encryptedFor:profile.id,lastKnownRevisionDate:original.revisionDate,login:{...original.login,password:enc(password)}};
      api('PUT',`/api/ciphers/${id}`,item,token);
      const readback=api('GET',`/api/ciphers/${id}`,undefined,token);
      if(decrypt(readback.login.password,key).toString()!==password)throw new Error('Vault readback mismatch');
      secret.password=password;save(secretsPath,secret);
    }
  };
  browser=await chromium.launch({headless:true});
  const runner={async execute({credential,nextPassword}) {
    step='baseline-login';
    const c=await context();
    let submitted=false;
    try {
      const {page,accepted}=await login(c,credential.username,credential.password);
      if(!accepted)throw new Error('Baseline login rejected');
      console.log('phpbb-baseline-login=ok');
      step='change-password';
      await page.goto(origin+'/ucp.php?i=ucp_profile&mode=reg_details');
      await page.locator('#new_password').fill(nextPassword);
      await page.locator('#password_confirm').fill(nextPassword);
      await page.locator('#cur_password').fill(credential.password);
      // Retain both candidates before any remote write for interrupted-test recovery.
      save(journalPath,{accountId:secret.cipherId,oldPassword:credential.password,nextPassword,stage:'before-submit'});
      await page.waitForTimeout(1500);
      submitted=true;
      await Promise.all([page.waitForNavigation(),page.locator('input[name="submit"]').click()]);
      save(journalPath,{accountId:secret.cipherId,oldPassword:credential.password,nextPassword,stage:'submitted'});
      await c.close();
      step='fresh-login-new-password';
      const fresh=await context();
      let works;try {works=(await login(fresh,credential.username,nextPassword)).accepted;}finally{await fresh.close();}
      if(!works)return {remoteChanged:true,verified:false};
      console.log('phpbb-fresh-new-password-login=ok');
      step='reject-old-password';
      const old=await context();
      let oldWorks;try{oldWorks=(await login(old,credential.username,credential.password)).accepted;}finally{await old.close();}
      if(oldWorks)return {remoteChanged:true,verified:false};
      console.log('phpbb-old-password-rejected=ok');
      return {remoteChanged:true,verified:true};
    } catch {
      return {remoteChanged:submitted,verified:false};
    } finally {await c.close();}
  }};
  const events=new EventBus();
  const recoveryStore={async put(id,password){save(journalPath,{accountId:id,nextPassword:password,stage:'vault-update-failed'});}};
  const orchestrator=new RotationOrchestrator({vault,runner,events,recoveryStore});
  const result=await orchestrator.rotate({accountId:secret.cipherId,passwordLength:24,template:{id:'phpbb-sit',version:'0.1.0',manifest:{allowedOrigins:[origin]}}});
  if(result.status!=='succeeded') {
    save(resultPath,{...result,step,events:events.history().map(e=>({type:e.type,time:e.time}))});
    throw new Error('Rotation incomplete; inspect private recovery journal');
  }
  step='fresh-login-from-vault';
  const stored=await vault.getCredential(secret.cipherId);
  const c=await context();
  let accepted;try{accepted=(await login(c,stored.username,stored.password)).accepted;}finally{await c.close();}
  if(!accepted)throw new Error('Vault credential login failed');
  fs.unlinkSync(journalPath);
  save(resultPath,{...result,phpbb:'3.3.19',origin,newPasswordLogin:true,oldPasswordRejected:true,vaultReadbackLogin:true,completedAt:new Date().toISOString(),events:events.history().map(e=>({type:e.type,time:e.time}))});
  console.log('phpbb-login-with-vault-readback=ok');
  console.log('orchestrator-rotation=succeeded');
}
try {await main();}catch {console.error('SIT test stopped at '+step+'; no secrets emitted');process.exitCode=1;}finally{if(browser)await browser.close();}
