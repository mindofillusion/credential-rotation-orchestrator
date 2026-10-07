import { createHash, verify as verifySignature } from 'node:crypto';
import { canonicalJson } from './canonical-json.js';

const ALLOWED_ACTIONS = new Set([
  'navigate',
  'fill-current-password',
  'fill-new-password',
  'fill-confirm-password',
  'click',
  'wait-for',
  'assert-text',
  'assert-url',
  'manual-checkpoint'
]);

export class TemplateVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TemplateVerificationError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TemplateVerificationError('invalid_manifest', `${field} must be a non-empty string`);
  }
}

function validateRecipe(recipe, manifest) {
  if (!recipe || recipe.schemaVersion !== 1 || !Array.isArray(recipe.steps)) {
    throw new TemplateVerificationError('invalid_recipe', 'Unsupported or incomplete recipe');
  }
  if (recipe.steps.length === 0 || recipe.steps.length > 100) {
    throw new TemplateVerificationError('invalid_recipe', 'Recipe must contain between 1 and 100 steps');
  }

  const allowedOrigins = new Set(manifest.allowedOrigins);
  for (const origin of allowedOrigins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new TemplateVerificationError('invalid_origin', `Invalid origin: ${origin}`);
    }
    if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
      throw new TemplateVerificationError('invalid_origin', `Origin must be an exact HTTPS origin: ${origin}`);
    }
  }

  for (const [index, step] of recipe.steps.entries()) {
    if (!step || !ALLOWED_ACTIONS.has(step.action)) {
      throw new TemplateVerificationError('forbidden_action', `Step ${index} uses a forbidden action`);
    }
    if ('script' in step || 'javascript' in step || 'command' in step) {
      throw new TemplateVerificationError('forbidden_code', `Step ${index} contains executable code`);
    }
    if (step.action === 'navigate') {
      const target = new URL(step.url);
      if (!allowedOrigins.has(target.origin)) {
        throw new TemplateVerificationError('origin_violation', `Navigation outside allowed origins: ${target.origin}`);
      }
    }
  }
}

export function verifyTemplateBundle(bundle, trustedKeys, now = new Date()) {
  if (!bundle || typeof bundle !== 'object') {
    throw new TemplateVerificationError('invalid_bundle', 'Bundle must be an object');
  }
  const { manifest, recipe, signature } = bundle;
  if (!manifest || manifest.schemaVersion !== 1) {
    throw new TemplateVerificationError('invalid_manifest', 'Unsupported manifest schema');
  }

  requireString(manifest.id, 'manifest.id');
  requireString(manifest.version, 'manifest.version');
  requireString(manifest.createdAt, 'manifest.createdAt');
  requireString(manifest.expiresAt, 'manifest.expiresAt');
  if (!Array.isArray(manifest.allowedOrigins) || manifest.allowedOrigins.length === 0) {
    throw new TemplateVerificationError('invalid_manifest', 'At least one allowed origin is required');
  }

  const expiresAt = new Date(manifest.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw new TemplateVerificationError('expired', 'Template metadata has expired');
  }

  const expectedDigest = manifest.files?.['recipe.json'];
  const actualDigest = sha256(canonicalJson(recipe));
  if (!expectedDigest || expectedDigest !== actualDigest) {
    throw new TemplateVerificationError('digest_mismatch', 'Recipe SHA-256 does not match the signed manifest');
  }

  if (!signature || signature.algorithm !== 'ed25519') {
    throw new TemplateVerificationError('invalid_signature', 'Only Ed25519 signatures are accepted');
  }
  const publicKey = trustedKeys.get(signature.keyId);
  if (!publicKey) {
    throw new TemplateVerificationError('untrusted_signer', `Unknown signing key: ${signature.keyId}`);
  }
  const valid = verifySignature(
    null,
    Buffer.from(canonicalJson(manifest)),
    publicKey,
    Buffer.from(signature.value, 'base64')
  );
  if (!valid) {
    throw new TemplateVerificationError('invalid_signature', 'Manifest signature is invalid');
  }

  validateRecipe(recipe, manifest);
  return {
    id: manifest.id,
    version: manifest.version,
    signer: signature.keyId,
    digest: actualDigest,
    trust: 'signed',
    manifest,
    recipe
  };
}

export function digestRecipe(recipe) {
  return sha256(canonicalJson(recipe));
}
