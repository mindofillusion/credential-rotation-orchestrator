// Dedicated SIT account and encrypted CRUD smoke test. Never use for production secrets.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const dir = process.env.CRO_SIT_ACCESS_DIR;
const host = process.env.CRO_SIT_SSH_HOST;
if (!dir?.startsWith('/') || !host || host.startsWith('-')) throw new Error('Set CRO_SIT_ACCESS_DIR and CRO_SIT_SSH_HOST');
const secretPath = `${dir}/sit-account.json`;
const email = 'cro-sit@example.invalid';
const ssh = ['-T', '-i', `${dir}/id_ed25519`, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=5', host, 'cro-sit'];
function rpc(request) {
  const p = spawnSync('ssh', ssh, { input: JSON.stringify(request) + '\n', encoding: 'utf8', timeout: 110000, maxBuffer: 3 * 1024 * 1024 });
  if (p.status !== 0) throw new Error('SSH transport failed');
  let r; try { r = JSON.parse(p.stdout); } catch { throw new Error('Unexpected broker response'); }
  if (!r.ok) throw new Error('Broker denied or failed');
  return r;
}
function api(method, path, body, token, form = false) {
  const headers = { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = rpc({action:'http', method, path, headers, body:body === undefined ? '' : form ? body : JSON.stringify(body)});
  const raw = Buffer.from(r.bodyBase64, 'base64').toString();
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status} at ${path}`);
  try { return JSON.parse(raw); } catch { return raw; }
}
const pause = ms => new Promise(r => setTimeout(r, ms));
async function ready() {
  for (let i = 0; i < 20; i++) { try { api('GET','/alive'); return; } catch {} await pause(1000); }
  throw new Error('SIT not ready');
}
function save(value, exclusive = false) {
  fs.writeFileSync(secretPath, JSON.stringify(value), {mode:0o600, flag:exclusive ? 'wx' : 'w'});
}
function encrypt(bytes, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key.subarray(0,32), iv);
  const data = Buffer.concat([cipher.update(bytes),cipher.final()]);
  const mac = crypto.createHmac('sha256',key.subarray(32)).update(Buffer.concat([iv,data])).digest();
  return '2.'+[iv,data,mac].map(x=>x.toString('base64')).join('|');
}
function decrypt(value,key) {
  if (!value.startsWith('2.')) throw new Error('Unsupported cipher format');
  const [iv,data,mac] = value.slice(2).split('|').map(x=>Buffer.from(x,'base64'));
  const actual = crypto.createHmac('sha256',key.subarray(32)).update(Buffer.concat([iv,data])).digest();
  if (mac.length !== actual.length || !crypto.timingSafeEqual(mac,actual)) throw new Error('Cipher authentication failed');
  const decipher = crypto.createDecipheriv('aes-256-cbc',key.subarray(0,32),iv);
  return Buffer.concat([decipher.update(data),decipher.final()]);
}
async function main() {
  process.umask(0o077);
  let secret;
  if (fs.existsSync(secretPath)) {
    const info = fs.lstatSync(secretPath);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error('Unsafe credential file');
    secret = JSON.parse(fs.readFileSync(secretPath));
  } else {
    secret = {email, password:crypto.randomBytes(36).toString('base64url'), device:crypto.randomUUID(), registered:false};
    save(secret,true);
  }
  if (secret.email !== email) throw new Error('Unexpected account');
  const master = crypto.pbkdf2Sync(secret.password,email,600000,32,'sha256');
  const hash = crypto.pbkdf2Sync(master,secret.password,1,32,'sha256').toString('base64');
  const expand = label => crypto.createHmac('sha256',master).update(Buffer.concat([Buffer.from(label),Buffer.from([1])])).digest();
  const stretched = Buffer.concat([expand('enc'),expand('mac')]);
  if (!secret.registered) {
    // Persist all key material before submitting registration; never silently replace it on retry.
    if (!secret.wrappedKey) {
      const userKey = crypto.randomBytes(64);
      const pair = crypto.generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'der'},privateKeyEncoding:{type:'pkcs8',format:'der'}});
      secret.wrappedKey = encrypt(userKey,stretched);
      secret.keys = { publicKey:pair.publicKey.toString('base64'), encryptedPrivateKey:encrypt(pair.privateKey,userKey) };
      save(secret);
    }
    try {
      rpc({action:'registrations-open'});
      await ready();
      const verification = api('POST','/identity/accounts/register/send-verification-email',{email,name:'CRO SIT'});
      if (typeof verification !== 'string') throw new Error('Unexpected verification response');
      api('POST','/identity/accounts/register/finish',{email,masterPasswordHash:hash,key:secret.wrappedKey,keys:secret.keys,kdf:0,kdfIterations:600000,emailVerificationToken:verification});
      secret.registered = true; save(secret);
      console.log('sit-account-created=ok');
    } finally {
      rpc({action:'registrations-close'});
      console.log('sit-registrations-closed=ok');
    }
  }
  await ready();
  const form = new URLSearchParams({grant_type:'password',username:email,password:hash,scope:'api offline_access',client_id:'cli',deviceType:'8',deviceIdentifier:secret.device,deviceName:'CRO SIT SER5'}).toString();
  const login = api('POST','/identity/connect/token',form,undefined,true);
  if (!login.access_token || !login.Key) throw new Error('Incomplete login response');
  const userKey = decrypt(login.Key,stretched);
  console.log('sit-login-and-key-unlock=ok');
  const e = text => encrypt(Buffer.from(text),userKey);
  const initial = crypto.randomBytes(24).toString('base64url');
  const changed = crypto.randomBytes(24).toString('base64url');
  const profile = api('GET','/api/accounts/profile',undefined,login.access_token);
  const owner = profile.id || profile.Id;
  if (!owner) throw new Error('Missing account id');
  const item = {encryptedFor:owner,type:1,name:e('CRO SIT encrypted CRUD smoke'),notes:e('Synthetic test only'),login:{username:e('sit-user'),password:e(initial),uris:[{uri:e('https://example.invalid'),match:null}]},favorite:false,reprompt:0,organizationId:null,folderId:null};
  let id;
  try {
    const created = api('POST','/api/ciphers',item,login.access_token);
    id = created.id || created.Id;
    if (!id) throw new Error('Missing cipher id');
    const first = api('GET',`/api/ciphers/${id}`,undefined,login.access_token);
    if (decrypt((first.login || first.Login).password || (first.login || first.Login).Password,userKey).toString() !== initial) throw new Error('Readback mismatch');
    item.login.password = e(changed);
    api('PUT',`/api/ciphers/${id}`,item,login.access_token);
    const second = api('GET',`/api/ciphers/${id}`,undefined,login.access_token);
    if (decrypt((second.login || second.Login).password || (second.login || second.Login).Password,userKey).toString() !== changed) throw new Error('Update mismatch');
    console.log('sit-encrypted-create-read-update=ok');
  } finally {
    if (id) { api('DELETE',`/api/ciphers/${id}`,undefined,login.access_token); console.log('sit-test-item-delete=ok'); }
  }
}
export { api, encrypt, decrypt };
export function connectExistingVault() {
  const info = fs.lstatSync(secretPath);
  if (!info.isFile() || (info.mode & 0o077)) throw new Error('Unsafe credential file');
  const secret = JSON.parse(fs.readFileSync(secretPath));
  if (secret.email !== email || !secret.registered) throw new Error('Expected existing SIT account');
  const master = crypto.pbkdf2Sync(secret.password,email,600000,32,'sha256');
  const hash = crypto.pbkdf2Sync(master,secret.password,1,32,'sha256').toString('base64');
  const expand = label => crypto.createHmac('sha256',master).update(Buffer.concat([Buffer.from(label),Buffer.from([1])])).digest();
  const stretched = Buffer.concat([expand('enc'),expand('mac')]);
  const form = new URLSearchParams({grant_type:'password',username:email,password:hash,scope:'api offline_access',client_id:'cli',deviceType:'8',deviceIdentifier:secret.device,deviceName:'CRO SIT'}).toString();
  const login = api('POST','/identity/connect/token',form,undefined,true);
  if (!login.access_token || !login.Key) throw new Error('Incomplete login');
  return {token:login.access_token,key:decrypt(login.Key,stretched)};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
