import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env first.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(187465092)");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const folder = new URL('../db/migrations/', import.meta.url);
  for (const name of (await readdir(folder)).filter(n => n.endsWith('.sql')).sort()) {
    const sql = (await readFile(new URL(name, folder), 'utf8')).replace(/\r\n/g, '\n');
    const hash = createHash('sha256').update(sql).digest('hex');
    const prior = (await client.query('SELECT hash FROM schema_migrations WHERE name = $1', [name])).rows[0];
    if (prior) { if (prior.hash !== hash) throw new Error('An applied migration was changed: ' + name); continue; }
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name, hash) VALUES ($1, $2)', [name, hash]);
    console.log('Applied ' + name);
  }
  await client.query('COMMIT');
  console.log('PostgreSQL schema is up to date.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }

