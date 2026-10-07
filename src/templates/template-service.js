import { createHash } from 'node:crypto';
import { canonicalJson } from '../core/canonical-json.js';
import { digestRecipe, verifyTemplateBundle } from '../core/template-verifier.js';

function bundleDigest(bundle) {
  return createHash('sha256').update(canonicalJson(bundle)).digest('hex');
}

function validateDraft(input) {
  if (!input || typeof input !== 'object') throw new Error('Template draft is required');
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(input.id || '')) {
    throw new Error('Template id must be a reverse-domain style identifier');
  }
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(input.version || '')) {
    throw new Error('Template version must use semantic versioning');
  }
  if (!Array.isArray(input.allowedOrigins) || input.allowedOrigins.length === 0) {
    throw new Error('At least one HTTPS origin is required');
  }
  if (!Array.isArray(input.steps)) throw new Error('Template steps must be an array');
}

export class TemplateService {
  constructor({ identity, trustedKeys, repository, events, verificationPolicy = {} }) {
    this.verificationPolicy = verificationPolicy;
    this.identity = identity;
    this.trustedKeys = trustedKeys;
    this.repository = repository;
    this.events = events;
  }

  async create(input) {
    validateDraft(input);
    const recipe = { schemaVersion: 1, steps: input.steps };
    const now = new Date();
    const expiresAt = input.expiresAt || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const manifest = {
      schemaVersion: 1,
      id: input.id,
      version: input.version,
      createdAt: now.toISOString(),
      expiresAt,
      allowedOrigins: [...new Set(input.allowedOrigins)],
      permissions: ['browser:navigate', 'browser:form-fill'],
      files: { 'recipe.json': digestRecipe(recipe) }
    };
    const bundle = { manifest, recipe, signature: this.identity.signManifest(manifest) };
    const verified = verifyTemplateBundle(bundle, this.trustedKeys.keyMap(), new Date(), this.verificationPolicy);
    const summary = await this.repository.install(bundle, verified, 'local');
    this.events?.emit('template.installed', summary.id, { version: summary.version, trust: summary.trust });
    return { summary, bundleSha256: bundleDigest(bundle) };
  }

  async import({ bundle, expectedSha256 }) {
    if (!/^[a-f0-9]{64}$/.test(expectedSha256 || '')) {
      throw new Error('An expected bundle SHA-256 is required');
    }
    const actualSha256 = bundleDigest(bundle);
    if (actualSha256 !== expectedSha256) throw new Error('Bundle SHA-256 mismatch');
    const verified = verifyTemplateBundle(bundle, this.trustedKeys.keyMap(), new Date(), this.verificationPolicy);
    const summary = await this.repository.install(bundle, verified, 'manual-import');
    this.events?.emit('template.installed', summary.id, { version: summary.version, trust: summary.trust });
    return { summary, bundleSha256: actualSha256 };
  }

  async export(id, version) {
    const record = await this.repository.get(id, version);
    if (!record) return null;
    return { bundle: record.bundle, bundleSha256: bundleDigest(record.bundle) };
  }
}

export { bundleDigest };
