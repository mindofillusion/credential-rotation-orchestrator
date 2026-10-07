import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign
} from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson } from '../core/canonical-json.js';
import { ensurePrivateDirectory, readJsonFile, writeJsonAtomic } from '../storage/secure-json-store.js';

const AAD = Buffer.from('cro-local-signing-identity:v1');

export function publicKeyFingerprint(publicKeyPem) {
  const body = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
  return createHash('sha256').update(Buffer.from(body, 'base64')).digest('hex');
}

export class LocalIdentity {
  constructor({ dataDirectory }) {
    this.directory = join(dataDirectory, 'identity');
    this.masterKeyPath = join(this.directory, 'master.key');
    this.identityPath = join(this.directory, 'signing-identity.json');
    this.record = null;
    this.masterKey = null;
  }

  async initialize() {
    await ensurePrivateDirectory(this.directory);
    this.masterKey = await this.#loadOrCreateMasterKey();
    this.record = await readJsonFile(this.identityPath);
    if (!this.record) {
      this.record = await this.#createIdentity();
      await writeJsonAtomic(this.identityPath, this.record);
    }
    this.#decryptPrivateKey();
    return this.publicIdentity();
  }

  async #loadOrCreateMasterKey() {
    try {
      const key = await readFile(this.masterKeyPath);
      if (key.length !== 32) throw new Error('Local master key has an invalid length');
      await chmod(this.masterKeyPath, 0o600);
      return key;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const key = randomBytes(32);
      try {
        await writeFile(this.masterKeyPath, key, { mode: 0o600, flag: 'wx' });
        return key;
      } catch (writeError) {
        if (writeError.code !== 'EEXIST') throw writeError;
        return readFile(this.masterKeyPath);
      }
    }
  }

  async #createIdentity() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const fingerprint = publicKeyFingerprint(publicKeyPem);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    cipher.setAAD(AAD);
    const encrypted = Buffer.concat([cipher.update(privateKeyPem, 'utf8'), cipher.final()]);

    return {
      schemaVersion: 1,
      keyId: `local-ed25519:${fingerprint}`,
      fingerprint,
      algorithm: 'ed25519',
      createdAt: new Date().toISOString(),
      publicKeyPem,
      privateKey: {
        cipher: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        ciphertext: encrypted.toString('base64')
      }
    };
  }

  #decryptPrivateKey() {
    const encrypted = this.record.privateKey;
    if (encrypted?.cipher !== 'aes-256-gcm') throw new Error('Unsupported identity cipher');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.masterKey,
      Buffer.from(encrypted.iv, 'base64')
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
  }

  publicIdentity() {
    if (!this.record) throw new Error('Identity is not initialized');
    const { privateKey, ...publicRecord } = this.record;
    return publicRecord;
  }

  trustedKeyEntry() {
    return [this.record.keyId, this.record.publicKeyPem];
  }

  signManifest(manifest) {
    const privateKeyPem = this.#decryptPrivateKey();
    return {
      algorithm: 'ed25519',
      keyId: this.record.keyId,
      value: sign(null, Buffer.from(canonicalJson(manifest)), privateKeyPem).toString('base64')
    };
  }
}
