import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword } from '../src/core/password-generator.js';

test('generates passwords with required character families', () => {
  const password = generatePassword(32);
  assert.equal(password.length, 32);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[!@#$%&*+\-=?_]/);
});

test('rejects unsafe password lengths', () => {
  assert.throws(() => generatePassword(8), RangeError);
});
