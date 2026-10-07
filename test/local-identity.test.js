import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalIdentity } from '../src/security/local-identity.js';

test('persists an encrypted local signing identity with restrictive file permissions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cro-identity-'));
  const first = new LocalIdentity({ dataDirectory: directory });
  const identity = await first.initialize();
  const stored = await readFile(join(directory, 'identity', 'signing-identity.json'), 'utf8');

  assert.equal(stored.includes('BEGIN PRIVATE KEY'), false);
  assert.match(stored, /aes-256-gcm/);
  assert.equal((await stat(join(directory, 'identity', 'master.key'))).mode & 0o777, 0o600);
  assert.equal((await stat(join(directory, 'identity', 'signing-identity.json'))).mode & 0o777, 0o600);

  const second = new LocalIdentity({ dataDirectory: directory });
  assert.equal((await second.initialize()).fingerprint, identity.fingerprint);
});
