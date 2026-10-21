import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { verifyPassword } from '../lib/password.mjs';
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.slice(1).startsWith('job_support_test')) throw new Error('Use a dedicated test database.');
const email = 'cli-' + randomBytes(10).toString('hex') + '@example.test';
const password = 'test-' + randomBytes(24).toString('hex');
const replacement = 'reset-' + randomBytes(24).toString('hex');
const pool = new pg.Pool({ connectionString: database });
async function interact(mode, values) {
  const child = spawn(process.execPath, ['scripts/account.mjs', mode], { env: { ...process.env, DATABASE_URL: database }, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
  const steps = [
    ['Account email: ', email],
    ...(mode === 'create-manager' ? [['Your display name: ', 'CLI manager']] : []),
    ['New password (12–128 characters, hidden): ', values],
    ['Repeat password (hidden): ', values],
  ];
  let output = '', pending = '', errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  child.stdout.on('data', chunk => {
    output += chunk; pending += chunk;
    while (steps.length && pending.includes(steps[0][0])) {
      const [prompt, answer] = steps.shift();
      pending = pending.slice(pending.indexOf(prompt) + prompt.length);
      child.stdin.write(answer + '\n');
    }
  });
  const timeout = setTimeout(() => child.kill(), 15000);
  const exit = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
  clearTimeout(timeout);
  assert.equal(exit, 0, errors);
  assert.equal(output.includes(values), false, 'The password must not be echoed.');
}
try {
  await interact('create-manager', password);
  const account = (await pool.query('SELECT * FROM users WHERE email=$1', [email])).rows[0];
  assert.equal(account.role, 'manager'); assert.equal(account.status, 'approved');
  assert.equal(await verifyPassword(password, account.password_hash), true);
  await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 hour')", [randomBytes(32).toString('hex'), account.id]);
  await interact('reset-password', replacement);
  const updated = (await pool.query('SELECT * FROM users WHERE email=$1', [email])).rows[0];
  assert.equal(await verifyPassword(replacement, updated.password_hash), true);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM sessions WHERE user_id=$1', [account.id])).rows[0].n, 0);
  console.log('CLI checks passed: manager bootstrap, hidden password input, password reset, session revocation.');
} finally { await pool.query('DELETE FROM users WHERE email=$1', [email]); await pool.end(); }

