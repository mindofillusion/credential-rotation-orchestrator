import test from 'node:test';
import assert from 'node:assert/strict';
import { convertCodegen } from '../src/templates/codegen-importer.js';

const base = { allowedOrigin: 'https://example.com', bindings: { '#old': 'fill-current-password' } };
test('converts action fragments without retaining recorded fill values', () => {
  const result = convertCodegen({ ...base, source: `await page.goto('https://example.com/password');\nawait page.locator('#old').fill('SECRET-123');\nawait page.locator('#submit').click();` });
  assert.equal(result.removedValues, 1);
  assert.equal(result.reviewRequired, true);
  assert.equal(result.steps[1].action, 'fill-current-password');
  assert.equal(result.steps.at(-1).action, 'manual-checkpoint');
  assert.doesNotMatch(JSON.stringify(result), /SECRET-123/);
});
test('rejects arbitrary JS, expressions, unknown fields and credential-bearing URLs', () => {
  for (const source of [
    "await page.evaluate('SECRET-123');", "await page.goto(process.env.URL);",
    "await page.goto(`https://example.com`);", "await page.goto('https://example.com'); process.exit();",
    "await page.goto('https://example.com/?token=SECRET-123');",
    "await page.goto('https://user:SECRET-123@example.com/');",
    "await page.goto('https://attacker.invalid/');",
    "await page.goto('https://example.com');\nawait page.locator('#unknown').fill('SECRET-123');"
  ]) {
    assert.throws(() => convertCodegen({ ...base, source }), (error) => !error.message.includes('SECRET-123'));
  }
});
test('rejects an entire recording when any line is unsupported', () => {
  assert.throws(() => convertCodegen({ ...base, source: "await page.goto('https://example.com');\nawait page.getByRole('button').click();" }));
});
