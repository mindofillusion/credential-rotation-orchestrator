import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ensurePrivateDirectory, readJsonFile, writeJsonAtomic } from '../storage/secure-json-store.js';
import { canonicalJson } from '../core/canonical-json.js';

function filename(id, version) {
  return `${createHash('sha256').update(`${id}@${version}`).digest('hex')}.json`;
}

export class TemplateRepository {
  constructor({ dataDirectory }) {
    this.directory = join(dataDirectory, 'templates');
  }

  async initialize() {
    await ensurePrivateDirectory(this.directory);
  }

  async install(bundle, verified, provenance) {
    const path = join(this.directory, filename(verified.id, verified.version));
    const existing = await readJsonFile(path);
    if (existing) {
      if (canonicalJson(existing.bundle) !== canonicalJson(bundle)) {
        throw new Error('Template id and version are immutable; publish a new version');
      }
      return this.#summary(existing);
    }
    const record = {
      schemaVersion: 1,
      installedAt: new Date().toISOString(),
      provenance,
      digest: verified.digest,
      bundle
    };
    try {
      await writeJsonAtomic(path, record, { exclusive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return this.install(bundle, verified, provenance);
    }
    return this.#summary(record);
  }

  async list() {
    const files = (await readdir(this.directory)).filter((name) => name.endsWith('.json')).sort();
    const records = await Promise.all(files.map((name) => readJsonFile(join(this.directory, name))));
    return records.filter(Boolean).map((record) => this.#summary(record));
  }

  async get(id, version) {
    return readJsonFile(join(this.directory, filename(id, version)));
  }

  #summary(record) {
    const { manifest, signature } = record.bundle;
    return {
      id: manifest.id,
      version: manifest.version,
      origins: manifest.allowedOrigins,
      signer: signature.keyId,
      trust: record.provenance === 'local' ? 'local-signed' : 'trusted-import',
      installedAt: record.installedAt,
      expiresAt: manifest.expiresAt,
      digest: record.digest
    };
  }
}
