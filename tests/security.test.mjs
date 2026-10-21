import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, validPassword, tokenHash } from '../lib/password.mjs';
test('passwords use unique salts and reject the wrong password', async () => {
  const password = 'a sufficiently long test password';
  const a = await hashPassword(password), b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword('a different test password', a), false);
  assert.equal(await verifyPassword(password, 'invalid'), false);
  assert.equal(a.includes(password), false);
});
test('password limits and session digests', async () => {
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('a'.repeat(129)), false);
  await assert.rejects(hashPassword('short'));
  assert.equal(tokenHash('secret-token').length, 64);
  assert.notEqual(tokenHash('a'), tokenHash('b'));
});

