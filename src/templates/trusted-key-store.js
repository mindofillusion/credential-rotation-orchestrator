import { createPublicKey } from 'node:crypto';
import { join } from 'node:path';
import { publicKeyFingerprint } from '../security/local-identity.js';
import { readJsonFile, writeJsonAtomic } from '../storage/secure-json-store.js';

export class TrustedKeyStore {
  constructor({ dataDirectory, localIdentity }) {
    this.path = join(dataDirectory, 'trusted-keys.json');
    this.localIdentity = localIdentity;
    this.records = [];
  }

  async initialize() {
    this.records = await readJsonFile(this.path, []);
    if (!Array.isArray(this.records)) throw new Error('Trusted key store is invalid');
  }

  list() {
    const local = this.localIdentity.publicIdentity();
    return [
      { keyId: local.keyId, fingerprint: local.fingerprint, source: 'local', createdAt: local.createdAt },
      ...this.records.map(({ publicKeyPem, ...record }) => record)
    ];
  }

  keyMap() {
    return new Map([
      this.localIdentity.trustedKeyEntry(),
      ...this.records.map((record) => [record.keyId, record.publicKeyPem])
    ]);
  }

  async trust({ keyId, publicKeyPem, expectedFingerprint }) {
    if (typeof keyId !== 'string' || keyId.length < 3) throw new Error('A keyId is required');
    if (typeof publicKeyPem !== 'string') throw new Error('A PEM public key is required');
    if (!/^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/.test(publicKeyPem)) {
      throw new Error('Only a PEM public key is accepted');
    }
    if (!/^[a-f0-9]{64}$/.test(expectedFingerprint || '')) {
      throw new Error('The expected SHA-256 fingerprint must contain 64 hexadecimal characters');
    }
    createPublicKey(publicKeyPem);
    const fingerprint = publicKeyFingerprint(publicKeyPem);
    if (fingerprint !== expectedFingerprint) throw new Error('Public key fingerprint mismatch');

    const local = this.localIdentity.publicIdentity();
    if (keyId === local.keyId) throw new Error('The local signing key is already trusted');
    const existing = this.records.find((record) => record.keyId === keyId);
    if (existing && existing.fingerprint !== fingerprint) {
      throw new Error('This keyId is already bound to a different fingerprint');
    }
    if (!existing) {
      this.records.push({ keyId, fingerprint, publicKeyPem, source: 'manual', createdAt: new Date().toISOString() });
      await writeJsonAtomic(this.path, this.records);
    }
    return { keyId, fingerprint, source: 'manual' };
  }
}
