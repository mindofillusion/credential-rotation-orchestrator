import { FORUM_SIT } from './sit-origins.js';
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
const ACTION_FIELDS = new Map([
  ['navigate', new Set(['action', 'url'])],
  ['fill-current-password', new Set(['action', 'selector'])],
  ['fill-new-password', new Set(['action', 'selector'])],
  ['fill-confirm-password', new Set(['action', 'selector'])],
  ['click', new Set(['action', 'selector'])],
  ['wait-for', new Set(['action', 'selector', 'timeoutMs'])],
  ['assert-text', new Set(['action', 'selector', 'value'])],
  ['assert-url', new Set(['action', 'url'])],
  ['manual-checkpoint', new Set(['action', 'message'])]
]);
const ALLOWED_PERMISSIONS = new Set(['browser:navigate', 'browser:form-fill']);
const MANIFEST_FIELDS = new Set([
  'schemaVersion', 'id', 'version', 'createdAt', 'expiresAt', 'allowedOrigins', 'permissions', 'files'
]);
const REQUIRED_STEP_FIELDS = new Map([
  ['navigate', ['url']],
  ['fill-current-password', ['selector']],
  ['fill-new-password', ['selector']],
  ['fill-confirm-password', ['selector']],
  ['click', ['selector']],
  ['wait-for', ['selector']],
  ['assert-text', ['value']],
  ['assert-url', ['url']],
  ['manual-checkpoint', ['message']]
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

function validateRecipe(recipe, manifest, policy) {
  if (!recipe || recipe.schemaVersion !== 1 || !Array.isArray(recipe.steps)) {
    throw new TemplateVerificationError('invalid_recipe', 'Unsupported or incomplete recipe');
  }
  if (recipe.steps.length === 0 || recipe.steps.length > 100) {
    throw new TemplateVerificationError('invalid_recipe', 'Recipe must contain between 1 and 100 steps');
  }

  const allowedOrigins = new Set(manifest.allowedOrigins);
  if (allowedOrigins.size !== manifest.allowedOrigins.length || allowedOrigins.size > 8) {
    throw new TemplateVerificationError('invalid_origin', 'Allowed origins must be unique and limited to eight');
  }
  for (const origin of allowedOrigins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new TemplateVerificationError('invalid_origin', `Invalid origin: ${origin}`);
    }
    const sitLoopback = (policy.allowPhpbbSitLoopback === true && origin === FORUM_SIT.phpbb.origin) ||
      (policy.allowForumSitLoopback === true && Object.values(FORUM_SIT).some(site=>site.origin===origin));
    if ((!sitLoopback && parsed.protocol !== 'https:') || parsed.origin !== origin) {
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
    const allowedFields = ACTION_FIELDS.get(step.action);
    const unexpected = Object.keys(step).find((field) => !allowedFields.has(field));
    if (unexpected) {
      throw new TemplateVerificationError('unexpected_field', `Step ${index} contains unexpected field: ${unexpected}`);
    }
    const missing = REQUIRED_STEP_FIELDS.get(step.action).find((field) => !(field in step));
    if (missing) {
      throw new TemplateVerificationError('invalid_recipe', `Step ${index} is missing ${missing}`);
    }
    for (const field of ['selector', 'value', 'message']) {
      if (field in step && (typeof step[field] !== 'string' || step[field].length === 0 || step[field].length > 500)) {
        throw new TemplateVerificationError('invalid_recipe', `Step ${index} has an invalid ${field}`);
      }
    }
    if ('timeoutMs' in step && (!Number.isInteger(step.timeoutMs) || step.timeoutMs < 0 || step.timeoutMs > 30_000)) {
      throw new TemplateVerificationError('invalid_recipe', `Step ${index} has an invalid timeout`);
    }
    if (step.action === 'navigate' || step.action === 'assert-url') {
      let target;
      try {
        target = new URL(step.url);
      } catch {
        throw new TemplateVerificationError('invalid_recipe', `Step ${index} has an invalid URL`);
      }
      if (!allowedOrigins.has(target.origin)) {
        throw new TemplateVerificationError('origin_violation', `URL outside allowed origins: ${target.origin}`);
      }
    }
  }
}

export function verifyTemplateBundle(bundle, trustedKeys, now = new Date(), policy = {}) {
  if (!bundle || typeof bundle !== 'object') {
    throw new TemplateVerificationError('invalid_bundle', 'Bundle must be an object');
  }
  const unexpectedBundleField = Object.keys(bundle).find((field) => !['manifest', 'recipe', 'signature'].includes(field));
  if (unexpectedBundleField) {
    throw new TemplateVerificationError('invalid_bundle', `Unexpected bundle field: ${unexpectedBundleField}`);
  }
  const { manifest, recipe, signature } = bundle;
  if (!manifest || manifest.schemaVersion !== 1) {
    throw new TemplateVerificationError('invalid_manifest', 'Unsupported manifest schema');
  }

  requireString(manifest.id, 'manifest.id');
  requireString(manifest.version, 'manifest.version');
  requireString(manifest.createdAt, 'manifest.createdAt');
  requireString(manifest.expiresAt, 'manifest.expiresAt');
  const unexpectedManifestField = Object.keys(manifest).find((field) => !MANIFEST_FIELDS.has(field));
  if (unexpectedManifestField) {
    throw new TemplateVerificationError('invalid_manifest', `Unexpected manifest field: ${unexpectedManifestField}`);
  }
  if (!Array.isArray(manifest.allowedOrigins) || manifest.allowedOrigins.length === 0) {
    throw new TemplateVerificationError('invalid_manifest', 'At least one allowed origin is required');
  }

  if (!Array.isArray(manifest.permissions) || manifest.permissions.some((value) => !ALLOWED_PERMISSIONS.has(value))) {
    throw new TemplateVerificationError('invalid_manifest', 'Manifest contains unsupported permissions');
  }

  const createdAt = new Date(manifest.createdAt);
  const expiresAt = new Date(manifest.expiresAt);
  if (!Number.isFinite(createdAt.getTime()) || createdAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    throw new TemplateVerificationError('invalid_manifest', 'Template creation time is invalid');
  }
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now || expiresAt <= createdAt) {
    throw new TemplateVerificationError('expired', 'Template metadata has expired');
  }

  const expectedDigest = manifest.files?.['recipe.json'];
  if (!manifest.files || Object.keys(manifest.files).length !== 1) {
    throw new TemplateVerificationError('invalid_manifest', 'Manifest must bind only recipe.json');
  }
  const actualDigest = sha256(canonicalJson(recipe));
  if (!expectedDigest || expectedDigest !== actualDigest) {
    throw new TemplateVerificationError('digest_mismatch', 'Recipe SHA-256 does not match the signed manifest');
  }

  if (!signature || signature.algorithm !== 'ed25519') {
    throw new TemplateVerificationError('invalid_signature', 'Only Ed25519 signatures are accepted');
  }
  if (Object.keys(signature).some((field) => !['algorithm', 'keyId', 'value'].includes(field))) {
    throw new TemplateVerificationError('invalid_signature', 'Signature contains unexpected fields');
  }
  requireString(signature.keyId, 'signature.keyId');
  requireString(signature.value, 'signature.value');
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

  validateRecipe(recipe, manifest, policy);
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
