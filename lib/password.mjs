import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const derive = (password, salt) => new Promise((resolve, reject) =>
  scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key)));
export function validPassword(password) { return typeof password === 'string' && password.length >= 12 && password.length <= 128; }
export async function hashPassword(password) {
  if (!validPassword(password)) throw new Error('Use a password with 12–128 characters.');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [version, salt, encoded] = String(stored).split('$');
  if (version !== 'scrypt-v1' || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(encoded)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(encoded, 'hex'));
}
export const tokenHash = value => createHash('sha256').update(value).digest('hex');
// Used for the same expensive verification when the email doesn't exist.
export const dummyPasswordHash = 'scrypt-v1$' + '0'.repeat(32) + '$' + '0'.repeat(128);

