import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonicalJson } from '../core/canonical-json.js';
import { digestRecipe, verifyTemplateBundle } from '../core/template-verifier.js';
import { EventBus } from '../core/event-bus.js';
import { RotationOrchestrator } from '../core/rotation-orchestrator.js';
import { MockVaultAdapter } from '../adapters/mock-vault.js';
import { MemoryRecoveryStore } from '../adapters/memory-recovery-store.js';
import { SimulationRunner } from '../adapters/simulation-runner.js';

const root = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '../..'));
const publicRoot = join(root, 'public');
function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const host = argumentValue('--host') || process.env.CRO_HOST || process.env.HOST || '127.0.0.1';
const port = Number(argumentValue('--port') || process.env.CRO_PORT || process.env.PORT || 8787);

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

function createDemoTemplate() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const recipe = {
    schemaVersion: 1,
    steps: [
      { action: 'navigate', url: 'https://example.com/.well-known/change-password' },
      { action: 'fill-current-password', selector: '#current-password' },
      { action: 'fill-new-password', selector: '#new-password' },
      { action: 'fill-confirm-password', selector: '#confirm-password' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'assert-text', value: 'Password updated' }
    ]
  };
  const manifest = {
    schemaVersion: 1,
    id: 'org.example.change-password',
    version: '0.1.0',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    allowedOrigins: ['https://example.com'],
    permissions: ['browser:navigate', 'browser:form-fill'],
    files: { 'recipe.json': digestRecipe(recipe) }
  };
  const signature = {
    algorithm: 'ed25519',
    keyId: 'demo-local-key',
    value: sign(null, Buffer.from(canonicalJson(manifest)), privateKey).toString('base64')
  };
  return verifyTemplateBundle(
    { manifest, recipe, signature },
    new Map([['demo-local-key', publicKey]])
  );
}

const template = createDemoTemplate();

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('Request too large');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStatic(pathname, response) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const resolved = normalize(join(publicRoot, relative));
  if (!resolved.startsWith(publicRoot)) return false;
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
    return json(response, 200, {
      mode: 'simulation',
      vault: { adapter: 'mock', connected: true },
      templates: [{ id: template.id, version: template.version, trust: template.trust, origins: template.manifest.allowedOrigins }],
      accounts,
      events: events.history().slice(0, 20)
    });
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
      const result = await orchestrator.rotate({ accountId: 'demo-account', template });
      vault.failUpdates = false;
      return json(response, 200, { ...result, recoveryPending: recoveryStore.has('demo-account') });
    } catch (error) {
      vault.failUpdates = false;
      return json(response, 400, { error: error.message });
    }
  }

  if (request.method === 'GET' && await serveStatic(url.pathname, response)) return;
  return json(response, 404, { error: 'Not found' });
});

server.listen(port, host, () => {
  console.log(`Credential Rotation Orchestrator listening on http://${host}:${port}`);
  console.log('Mode: simulation only; no real vault or website is accessed.');
});
