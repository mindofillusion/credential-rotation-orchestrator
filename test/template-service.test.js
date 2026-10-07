import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalIdentity } from '../src/security/local-identity.js';
import { TemplateRepository } from '../src/templates/template-repository.js';
import { TemplateService } from '../src/templates/template-service.js';
import { TrustedKeyStore } from '../src/templates/trusted-key-store.js';

async function services(prefix) {
  const dataDirectory = await mkdtemp(join(tmpdir(), prefix));
  const identity = new LocalIdentity({ dataDirectory });
  await identity.initialize();
  const trustedKeys = new TrustedKeyStore({ dataDirectory, localIdentity: identity });
  await trustedKeys.initialize();
  const repository = new TemplateRepository({ dataDirectory });
  await repository.initialize();
  return {
    identity,
    trustedKeys,
    repository,
    service: new TemplateService({ identity, trustedKeys, repository })
  };
}

const draft = {
  id: 'org.example.account-password',
  version: '1.0.0',
  allowedOrigins: ['https://example.com'],
  steps: [{ action: 'navigate', url: 'https://example.com/.well-known/change-password' }]
};

test('concurrent installs cannot overwrite an existing version', async () => {
  const context = await services('cro-concurrent-');
  const results = await Promise.allSettled([
    context.service.create(draft),
    context.service.create({ ...draft, steps: [{ action: 'navigate', url: 'https://example.com/other' }] })
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await context.repository.list()).length, 1);
});

test('creates, signs, persists and exports a local template', async () => {
  const context = await services('cro-template-create-');
  const created = await context.service.create(draft);
  const exported = await context.service.export(draft.id, draft.version);

  assert.equal(created.summary.trust, 'local-signed');
  assert.equal(exported.bundleSha256, created.bundleSha256);
  assert.equal((await context.repository.list()).length, 1);

  await assert.rejects(
    context.service.create({ ...draft, steps: [{ action: 'navigate', url: 'https://example.com/changed' }] }),
    /immutable/
  );
});

test('imports only a digest-matching bundle from an explicitly trusted signer', async () => {
  const source = await services('cro-template-source-');
  await source.service.create(draft);
  const exported = await source.service.export(draft.id, draft.version);

  const target = await services('cro-template-target-');
  const publicIdentity = source.identity.publicIdentity();
  await target.trustedKeys.trust({
    keyId: publicIdentity.keyId,
    publicKeyPem: publicIdentity.publicKeyPem,
    expectedFingerprint: publicIdentity.fingerprint
  });

  const imported = await target.service.import({
    bundle: exported.bundle,
    expectedSha256: exported.bundleSha256
  });
  assert.equal(imported.summary.trust, 'trusted-import');

  await assert.rejects(
    target.service.import({ bundle: exported.bundle, expectedSha256: '0'.repeat(64) }),
    /SHA-256 mismatch/
  );
});

test('refuses an imported bundle whose signer is not trusted', async () => {
  const source = await services('cro-template-untrusted-source-');
  await source.service.create(draft);
  const exported = await source.service.export(draft.id, draft.version);
  const target = await services('cro-template-untrusted-target-');

  await assert.rejects(
    target.service.import({ bundle: exported.bundle, expectedSha256: exported.bundleSha256 }),
    /Unknown signing key/
  );
});
