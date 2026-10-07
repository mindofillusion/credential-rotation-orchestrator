import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonicalJson } from '../src/core/canonical-json.js';
import { digestRecipe, verifyTemplateBundle, TemplateVerificationError } from '../src/core/template-verifier.js';

function signedBundle(recipeOverride = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const recipe = {
    schemaVersion: 1,
    steps: [{ action: 'navigate', url: 'https://example.com/account/password' }],
    ...recipeOverride
  };
  const manifest = {
    schemaVersion: 1,
    id: 'org.example.password',
    version: '1.0.0',
    createdAt: '2026-10-07T00:00:00.000Z',
    expiresAt: '2027-10-07T00:00:00.000Z',
    allowedOrigins: ['https://example.com'],
    permissions: ['browser:navigate'],
    files: { 'recipe.json': digestRecipe(recipe) }
  };
  const signature = {
    algorithm: 'ed25519',
    keyId: 'test-key',
    value: sign(null, Buffer.from(canonicalJson(manifest)), privateKey).toString('base64')
  };
  return { bundle: { manifest, recipe, signature }, keys: new Map([['test-key', publicKey]]) };
}

test('accepts a correctly signed declarative template', () => {
  const { bundle, keys } = signedBundle();
  const verified = verifyTemplateBundle(bundle, keys, new Date('2026-10-07T10:00:00Z'));
  assert.equal(verified.trust, 'signed');
  assert.equal(verified.id, 'org.example.password');
});

test('rejects a recipe modified after the manifest was signed', () => {
  const { bundle, keys } = signedBundle();
  bundle.recipe.steps.push({ action: 'click', selector: '#malicious-change' });
  assert.throws(
    () => verifyTemplateBundle(bundle, keys, new Date('2026-10-07T10:00:00Z')),
    (error) => error instanceof TemplateVerificationError && error.code === 'digest_mismatch'
  );
});

test('rejects navigation outside signed origins', () => {
  const { bundle, keys } = signedBundle({
    steps: [{ action: 'navigate', url: 'https://attacker.invalid/collect' }]
  });
  assert.throws(
    () => verifyTemplateBundle(bundle, keys, new Date('2026-10-07T10:00:00Z')),
    (error) => error instanceof TemplateVerificationError && error.code === 'origin_violation'
  );
});

test('rejects executable code embedded in a recipe', () => {
  const { bundle, keys } = signedBundle({
    steps: [{ action: 'click', selector: '#submit', javascript: 'stealSecrets()' }]
  });
  assert.throws(
    () => verifyTemplateBundle(bundle, keys, new Date('2026-10-07T10:00:00Z')),
    (error) => error instanceof TemplateVerificationError && error.code === 'forbidden_code'
  );
});

test('rejects unexpected step fields even when no executable field is named', () => {
  const { bundle, keys } = signedBundle({
    steps: [{ action: 'click', selector: '#submit', payload: 'undeclared capability' }]
  });
  assert.throws(
    () => verifyTemplateBundle(bundle, keys, new Date('2026-10-07T10:00:00Z')),
    (error) => error instanceof TemplateVerificationError && error.code === 'unexpected_field'
  );
});

test('applies the origin allowlist to URL assertions', () => {
  const { bundle, keys } = signedBundle({
    steps: [{ action: 'assert-url', url: 'https://attacker.invalid/completed' }]
  });
  assert.throws(
    () => verifyTemplateBundle(bundle, keys, new Date('2026-10-07T10:00:00Z')),
    (error) => error instanceof TemplateVerificationError && error.code === 'origin_violation'
  );
});

function localFixture(origin) {
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const recipe={schemaVersion:1,steps:[{action:'navigate',url:origin+'/ucp.php'}]};
  const manifest={schemaVersion:1,id:'org.phpbb.sit',version:'1.0.0',createdAt:'2026-10-07T00:00:00Z',expiresAt:'2027-10-07T00:00:00Z',allowedOrigins:[origin],permissions:['browser:navigate'],files:{'recipe.json':digestRecipe(recipe)}};
  return {bundle:{manifest,recipe,signature:{algorithm:'ed25519',keyId:'sit-key',value:sign(null,Buffer.from(canonicalJson(manifest)),privateKey).toString('base64')}},keys:new Map([['sit-key',publicKey]])};
}
test('HTTP fixture requires explicit SIT policy and exactly the configured loopback port',()=>{
  const now=new Date('2026-10-07T10:00:00Z');
  const {bundle,keys}=localFixture('http://127.0.0.1:8224');
  assert.throws(()=>verifyTemplateBundle(bundle,keys,now),{code:'invalid_origin'});
  assert.equal(verifyTemplateBundle(bundle,keys,now,{allowPhpbbSitLoopback:true}).trust,'signed');
  for(const origin of ['http://127.0.0.1:8223','http://localhost:8224','http://example.com']) {
    const other=localFixture(origin);
    assert.throws(()=>verifyTemplateBundle(other.bundle,other.keys,now,{allowPhpbbSitLoopback:true}),{code:'invalid_origin'});
  }
  bundle.recipe.steps[0].url='http://127.0.0.1:8224/altered';
  assert.throws(()=>verifyTemplateBundle(bundle,keys,now,{allowPhpbbSitLoopback:true}),{code:'digest_mismatch'});
});

test('forum SIT policy only permits the three fixed fixture origins',()=>{
 const now=new Date('2026-10-07T10:00:00Z');
 for(const port of [8224,8226,8227]) {
  const {bundle,keys}=localFixture(`http://127.0.0.1:${port}`);
  assert.throws(()=>verifyTemplateBundle(bundle,keys,now),{code:'invalid_origin'});
  assert.equal(verifyTemplateBundle(bundle,keys,now,{allowForumSitLoopback:true}).trust,'signed');
 }
 for(const origin of ['http://127.0.0.1:8223','http://127.0.0.1:18082','http://localhost:8227','http://192.168.8.189:8227']) {
  const {bundle,keys}=localFixture(origin);
  assert.throws(()=>verifyTemplateBundle(bundle,keys,now,{allowForumSitLoopback:true}),{code:'invalid_origin'});
 }
});
