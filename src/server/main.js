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

const events = new EventBus();
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
const templateService = new TemplateService({ identity, trustedKeys, repository: templateRepository, events });

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

async function simulationTemplate() {
  const selected = (await templateRepository.list())[0];
  const exported = await templateService.export(selected.id, selected.version);
  return verifyTemplateBundle(exported.bundle, trustedKeys.keyMap());
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
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === 'GET' && url.pathname === '/api/overview') {
    const accounts = await vault.listEntries();
    const templates = await templateRepository.list();
    return json(response, 200, {
      mode: 'simulation',
      vault: { adapter: 'mock', connected: true },
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
  console.log('Mode: simulation only; no real vault or website is accessed.');
  console.log(`Local data: ${dataDirectory}`);
});
