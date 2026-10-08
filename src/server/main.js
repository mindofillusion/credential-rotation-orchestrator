import { LabService } from '../lab/service.js';
import {remoteSitConfig,forwardSit} from './remote-sit.js';
import { UpdateManager } from '../updates/manager.js';
import { randomBytes } from 'node:crypto';
import { PhpbbSitController } from './phpbb-sit.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyTemplateBundle } from '../core/template-verifier.js';
import { EventBus } from '../core/event-bus.js';
import { RotationOrchestrator } from '../core/rotation-orchestrator.js';
import { MockVaultAdapter } from '../adapters/mock-vault.js';
import { MemoryRecoveryStore } from '../adapters/memory-recovery-store.js';
import { SimulationRunner } from '../adapters/simulation-runner.js';
import { LocalIdentity } from '../security/local-identity.js';
import { TemplateRepository } from '../templates/template-repository.js';
import { TemplateService } from '../templates/template-service.js';
import { TrustedKeyStore } from '../templates/trusted-key-store.js';
import { convertCodegen } from '../templates/codegen-importer.js';

const root = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '../..'));
const publicRoot = join(root, 'public');
function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const host = argumentValue('--host') || process.env.CRO_HOST || '127.0.0.1';
const port = Number(argumentValue('--port') || process.env.CRO_PORT || process.env.PORT || 8787);
const dataDirectory = normalize(
  argumentValue('--data-dir') || process.env.CRO_DATA_DIR || join(root, '.cro-data')
);

const appVersion=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
const pairedDirectory=process.env.CRO_REMOTE_SIT_DIR;
const pairedSit=await remoteSitConfig(pairedDirectory);
const updateToken=randomBytes(32).toString('hex');
const labToken=randomBytes(32).toString('hex');
const lab=new LabService({dataDirectory,sourceRoot:root});
await lab.initialize();
const updater=new UpdateManager({root:process.env.CRO_INSTALL_ROOT,version:appVersion,sourceRoot:root,port,host,dataDirectory});

const cmsEnabled=process.env.CRO_ENABLE_CMS_SIT === '1';
if(cmsEnabled && !isAbsolute(process.env.CRO_CMS_SIT_DIR || ''))throw new Error('Explicit CMS fixture directory required');
const forumsEnabled=process.env.CRO_ENABLE_FORUMS_SIT === '1';
const sitEnabled = cmsEnabled || forumsEnabled || process.env.CRO_ENABLE_PHPBB_SIT === '1';
if(forumsEnabled && !isAbsolute(process.env.CRO_FORUMS_SIT_DIR || ''))throw new Error('Explicit forums fixture directory required');
if (sitEnabled && (host !== '127.0.0.1' || !isAbsolute(process.env.CRO_PHPBB_SIT_DIR || '') || !isAbsolute(process.env.CRO_SIT_ACCESS_DIR || '') || !process.env.CRO_SIT_SSH_HOST)) {
  throw new Error('SIT mode requires loopback binding and explicit fixture/vault configuration');
}
const verificationPolicy = { allowPhpbbSitLoopback: sitEnabled, allowForumSitLoopback: forumsEnabled, allowCmsSitLoopback:cmsEnabled };
const sitToken = randomBytes(32).toString('hex');
const events = new EventBus();
const sit = sitEnabled ? new PhpbbSitController({directory:process.env.CRO_PHPBB_SIT_DIR,sourceRoot:root,events}) : null;
const forums = new Map(sit ? [['phpbb',sit]] : []);
if(forumsEnabled)for(const engine of ['mybb','smf'])forums.set(engine,new PhpbbSitController({engine,directory:join(process.env.CRO_FORUMS_SIT_DIR,engine),runtimeDirectory:process.env.CRO_PHPBB_SIT_DIR,sourceRoot:root,events}));
if(cmsEnabled)for(const engine of ['wordpress','joomla','drupal'])forums.set(engine,new PhpbbSitController({engine,directory:join(process.env.CRO_CMS_SIT_DIR,engine),runtimeDirectory:process.env.CRO_PHPBB_SIT_DIR,sourceRoot:root,events}));
const vault = new MockVaultAdapter([
  {
    id: 'demo-account',
    site: 'Example Service',
    origin: 'https://example.com',
    username: 'demo@example.invalid',
    password: 'demo-current-password',
    policy: 'assisted',
    lastRotatedAt: null
  }
]);
const recoveryStore = new MemoryRecoveryStore();
const identity = new LocalIdentity({ dataDirectory });
await identity.initialize();
const trustedKeys = new TrustedKeyStore({ dataDirectory, localIdentity: identity });
await trustedKeys.initialize();
const templateRepository = new TemplateRepository({ dataDirectory });
await templateRepository.initialize();
const templateService = new TemplateService({ identity, trustedKeys, repository: templateRepository, events, verificationPolicy });

if ((await templateRepository.list()).length === 0) {
  await templateService.create({
    id: 'org.example.change-password',
    version: '0.2.0',
    allowedOrigins: ['https://example.com'],
    steps: [
      { action: 'navigate', url: 'https://example.com/.well-known/change-password' },
      { action: 'fill-current-password', selector: '#current-password' },
      { action: 'fill-new-password', selector: '#new-password' },
      { action: 'fill-confirm-password', selector: '#confirm-password' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'assert-text', value: 'Password updated' }
    ]
  });
}

if (sitEnabled && !(await templateRepository.list()).some(t=>t.id==='org.phpbb.sit-password' && t.version==='0.1.0')) {
  const draft=JSON.parse(await readFile(join(root,'sit/phpbb/template-draft.json'),'utf8'));
  await templateService.create(draft);
}

if(forumsEnabled)for(const engine of ['mybb','smf']) {
  const draft=JSON.parse(await readFile(join(root,`sit/forums/${engine}-template.json`),'utf8'));
  if(!(await templateRepository.list()).some(t=>t.id===draft.id && t.version===draft.version))await templateService.create(draft);
}

if(cmsEnabled)for(const engine of ['wordpress','joomla','drupal']) {
 const draft=JSON.parse(await readFile(join(root,`sit/cms/${engine}-template.json`),'utf8'));
 if(!(await templateRepository.list()).some(t=>t.id===draft.id&&t.version===draft.version))await templateService.create(draft);
}

async function simulationTemplate() {
  const selected = (await templateRepository.list())[0];
  const exported = await templateService.export(selected.id, selected.version);
  return verifyTemplateBundle(exported.bundle, trustedKeys.keyMap(), new Date(), verificationPolicy);
}

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('Request too large');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function acceptsMutation(request) {
  if (request.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' && parsed.host === request.headers.host;
  } catch {
    return false;
  }
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const resolved = resolve(publicRoot, requested);
  const scoped = relative(publicRoot, resolved);
  if (scoped.startsWith('..') || isAbsolute(scoped)) return false;
  try {
    const body = await readFile(resolved);
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8'
    }[extname(resolved)] || 'application/octet-stream';
    response.writeHead(200, {
      'content-type': mime,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cross-origin-resource-policy': 'same-origin',
      'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}


const server = createServer(async (request, response) => {
  if (sitEnabled && request.headers.host !== `127.0.0.1:${port}`) return json(response,403,{error:'Host rejected'});
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === 'GET' && url.pathname === '/api/health')return json(response,200,{application:'credential-rotation-orchestrator',version:appVersion,mode:pairedSit?'paired-sit':sitEnabled?'sit':'simulation'});

  if(url.pathname.startsWith('/api/updates/')){
    if(request.headers.host!==`127.0.0.1:${port}`)return json(response,403,{error:'Accès local uniquement'});
    if(request.method==='GET'&&url.pathname==='/api/updates/status'){
      let last=null;try{last=JSON.parse(await readFile(join(process.env.CRO_INSTALL_ROOT,'last-update.json'),'utf8'));}catch{}
      return json(response,200,{version:appVersion,enabled:!!process.env.CRO_INSTALL_ROOT,token:updateToken,last});
    }
    if(request.method!=='POST'||request.headers.origin!==`http://127.0.0.1:${port}`||request.headers['x-cro-update-token']!==updateToken)return json(response,403,{error:'Requête de mise à jour refusée'});
    try{
      const patch=await readJson(request);
      if(url.pathname==='/api/updates/check'){const c=await updater.check(patch);return json(response,200,{version:c.manifest.version,files:c.files.length,verified:true});}
      if(url.pathname==='/api/updates/install'){
        const job=await updater.stage(patch);const child=updater.launch(job.jobPath);
        child.once('error',()=>{updater.busy=false;});
        child.once('spawn',()=>{json(response,202,{status:'installing',version:job.version});setTimeout(()=>{server.closeAllConnections();server.close(()=>process.exit(0));},300);});return;
      }
    }catch(e){return json(response,400,{error:e.message});}
    return json(response,404,{error:'Route inconnue'});
  }

  // Local laboratory data must never be forwarded to the paired SIT server.
  if(url.pathname.startsWith('/api/lab/')){
    if(host!=='127.0.0.1'||request.headers.host!==`127.0.0.1:${port}`)return json(response,403,{error:'Accès local uniquement'});
    try {
      if(request.method==='GET'&&url.pathname==='/api/lab/overview')return json(response,200,{...await lab.overview(),token:labToken});
      if(request.method!=='POST'||request.headers.origin!==`http://127.0.0.1:${port}`||request.headers['x-cro-lab-token']!==labToken)return json(response,403,{error:'Requête Laboratoire refusée'});
      const body=await readJson(request);
      if(url.pathname==='/api/lab/instances')return json(response,200,await lab.createInstance(body));
      if(url.pathname==='/api/lab/checkpoints')return json(response,200,await lab.createCheckpoint(body));
      if(url.pathname==='/api/lab/inspect')return json(response,200,await lab.inspect(body.id));
      if(url.pathname==='/api/lab/acknowledge')return json(response,200,await lab.acknowledge(body));
      if(url.pathname==='/api/lab/close')return json(response,200,await lab.close(body));
      return json(response,404,{error:'Route Laboratoire inconnue'});
    } catch {return json(response,400,{error:'Opération refusée : vérifier les champs, les attentes actives et la disponibilité de Mailpit.'});}
  }

  if(pairedSit&&url.pathname.startsWith('/api/')&&url.pathname!=='/api/health'){
    if(request.headers.host!==`127.0.0.1:${port}`)return json(response,403,{error:'Host rejected'});
    try{return await forwardSit(request,response,pairedSit,pairedDirectory);}catch{return json(response,502,{error:'Configuration du raccordement SIT invalide'});}
  }

  if (request.method === 'GET' && url.pathname === '/api/overview') {
    const sitState = sit ? await sit.state() : null;
    const forumStates=await Promise.all([...forums.values()].map(f=>f.state()));
    const accounts = sitState ? forumStates.flatMap(f=>f.account?[f.account]:[]) : await vault.listEntries();
    const templates = await templateRepository.list();
    return json(response, 200, {
      application:{name:'Credential Rotation Orchestrator',version:appVersion},
      mode: sitEnabled ? 'Sites SIT' : 'simulation',
      vault: { adapter: sitEnabled ? 'Vaultwarden SIT' : 'mock', connected: sitEnabled ? Boolean(sitState?.lastResult?.vaultUpdated) : true },
      sit: sitState,
      forums: forumStates,
      sitToken: sitEnabled ? sitToken : undefined,
      identity: identity.publicIdentity(),
      templates,
      accounts,
      events: events.history().slice(0, 20)
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/templates') {
    return json(response, 200, await templateRepository.list());
  }

  if (request.method === 'GET' && url.pathname === '/api/trust/keys') {
    return json(response, 200, trustedKeys.list());
  }

  if (request.method === 'GET' && url.pathname === '/api/templates/export') {
    const exported = await templateService.export(url.searchParams.get('id'), url.searchParams.get('version'));
    return exported ? json(response, 200, exported) : json(response, 404, { error: 'Template not found' });
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    return json(response, 200, events.history());
  }

  if (request.method === 'GET' && url.pathname === '/api/events/stream') {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    });
    response.write(': connected\n\n');
    const unsubscribe = events.subscribe((event) => {
      response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    request.on('close', unsubscribe);
    return;
  }

  if (request.method === 'POST' && ['/api/sit/phpbb/run','/api/sit/forums/run'].includes(url.pathname)) {
    if (!sit) return json(response,404,{error:'SIT mode is disabled'});
    if (request.headers.origin !== `http://127.0.0.1:${port}` || request.headers['x-cro-sit-token'] !== sitToken || !acceptsMutation(request)) {
      return json(response,403,{error:'Same-origin SIT authorization required'});
    }
    try {
      const body=await readJson(request);
      if(Object.keys(body).some(k=>!['id','version','engine'].includes(k)))throw new Error('Unexpected fields');
      const controller=forums.get(url.pathname==='/api/sit/phpbb/run'?'phpbb':body.engine);
      if(!controller)throw new Error('Unknown fixture');
      const exported=await templateService.export(body.id,body.version);
      if(!exported) return json(response,404,{error:'Template not found'});
      return json(response,200,await controller.run(exported.bundle,trustedKeys.keyMap()));
    } catch(error) {
      return json(response,400,{error:error.code ? `Template rejected: ${error.code}` : error.message});
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/simulations/run') {
    if (!acceptsMutation(request)) return json(response, 403, { error: 'Cross-site mutation rejected' });
    try {
      const body = await readJson(request);
      const outcome = ['success', 'failure', 'ambiguous', 'vault-failure'].includes(body.outcome)
        ? body.outcome
        : 'success';
      vault.failUpdates = outcome === 'vault-failure';
      const orchestrator = new RotationOrchestrator({
        vault,
        runner: new SimulationRunner({ outcome: outcome === 'vault-failure' ? 'success' : outcome }),
        events,
        recoveryStore
      });
      const result = await orchestrator.rotate({ accountId: 'demo-account', template: await simulationTemplate() });
      vault.failUpdates = false;
      return json(response, 200, { ...result, recoveryPending: recoveryStore.has('demo-account') });
    } catch (error) {
      vault.failUpdates = false;
      return json(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/templates/convert-codegen') {
    if (!acceptsMutation(request)) return json(response, 403, { error: 'Cross-site mutation rejected' });
    try {
      return json(response, 200, convertCodegen(await readJson(request)));
    } catch {
      // Never reflect parser input or JSON syntax errors containing recorded secrets.
      return json(response, 400, { error: 'Recording rejected. Check the supported syntax, origin and field bindings.' });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/templates') {
    if (!acceptsMutation(request)) return json(response, 403, { error: 'Cross-site mutation rejected' });
    try {
      return json(response, 201, await templateService.create(await readJson(request)));
    } catch (error) {
      return json(response, 400, { error: error.message, code: error.code });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/templates/import') {
    if (!acceptsMutation(request)) return json(response, 403, { error: 'Cross-site mutation rejected' });
    try {
      return json(response, 201, await templateService.import(await readJson(request)));
    } catch (error) {
      return json(response, 400, { error: error.message, code: error.code });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/trust/keys') {
    if (!acceptsMutation(request)) return json(response, 403, { error: 'Cross-site mutation rejected' });
    try {
      const trusted = await trustedKeys.trust(await readJson(request));
      events.emit('template.signer.trusted', trusted.keyId, { fingerprint: trusted.fingerprint });
      return json(response, 201, trusted);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  }

  if (request.method === 'GET' && await serveStatic(url.pathname, response)) return;
  return json(response, 404, { error: 'Not found' });
});

server.listen(port, host, () => {
  console.log(`Credential Rotation Orchestrator listening on http://${host}:${port}`);
  console.log(sitEnabled ? 'Mode: real forum SIT rotations on the fixed local fixture.' : 'Mode: simulation only; no real vault or website is accessed.');
  console.log(`Local data: ${dataDirectory}`);
});
