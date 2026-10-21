import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hashPassword } from '../lib/password.mjs';
const mode = process.argv[2];
if (!['create-manager', 'reset-password'].includes(mode)) throw new Error('Use create-manager or reset-password.');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env first.');
let muted = false;
const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
const prompt = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const email = (await prompt.question('Account email: ')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email.');
  const name = mode === 'create-manager' ? (await prompt.question('Your display name: ')).trim().slice(0, 100) : '';
  process.stdout.write('New password (12–128 characters, hidden): ');
  muted = true;
  const password = await prompt.question('');
  muted = false; process.stdout.write('\n');
  process.stdout.write('Repeat password (hidden): ');
  muted = true;
  const repeat = await prompt.question('');
  muted = false; process.stdout.write('\n');
  if (password !== repeat) throw new Error('Passwords do not match.');
  const hash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (mode === 'create-manager') {
      if (!name) throw new Error('A name is required.');
      await client.query("INSERT INTO users(id,email,name,password_hash,role,status,created_at) VALUES ($1,$2,$3,$4,'manager','approved',$5)", [randomUUID(), email, name, hash, new Date().toISOString()]);
    } else {
      const result = await client.query('UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id', [hash, email]);
      if (!result.rowCount) throw new Error('Account not found.');
      await client.query('DELETE FROM sessions WHERE user_id = $1', [result.rows[0].id]);
    }
    await client.query('COMMIT');
    console.log(mode === 'create-manager' ? 'Manager created. Sign in with this email and password.' : 'Password reset. Existing sessions revoked.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
} finally { prompt.close(); await pool.end(); }

