import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*+-=?_';

function pick(alphabet) {
  return alphabet[randomInt(0, alphabet.length)];
}

export function generatePassword(length = 24) {
  if (!Number.isInteger(length) || length < 16 || length > 128) {
    throw new RangeError('Password length must be between 16 and 128');
  }
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const alphabet = UPPER + LOWER + DIGITS + SYMBOLS;
  while (required.length < length) required.push(pick(alphabet));

  for (let index = required.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [required[index], required[swapIndex]] = [required[swapIndex], required[index]];
  }
  return required.join('');
}
