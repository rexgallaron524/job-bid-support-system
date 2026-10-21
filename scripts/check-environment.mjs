import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
const root = fileURLToPath(new URL('../', import.meta.url));
let failed = false;
function check(ok, message) { console.log((ok ? 'OK       ' : 'MISSING  ') + message); if (!ok) failed = true; }
console.log('All in one place-job support — environment check\n');
const [major, minor] = process.versions.node.split('.').map(Number);
check(major > 22 || (major === 22 && minor >= 13), 'Node.js 22.13+ (current: ' + process.versions.node + ')');
check(existsSync(path.join(root, 'node_modules/next/package.json')), 'Dependencies installed (npm ci)');
check(Boolean(process.env.DATABASE_URL), 'DATABASE_URL configured in .env');
try { const origin = new URL(process.env.APP_ORIGIN); check(['http:', 'https:'].includes(origin.protocol) && origin.origin === process.env.APP_ORIGIN && (process.env.NODE_ENV !== 'production' || origin.protocol === 'https:'), 'APP_ORIGIN is an exact origin; production requires HTTPS'); }
catch { check(false, 'APP_ORIGIN configured (example: http://localhost:3000)'); }
check(/^[a-z0-9][a-z0-9-]{2,79}$/.test(process.env.MANAGER_PATH || 'manager'), 'Manager URL path is valid');
if (process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const result = await pool.query("SELECT current_setting('server_version') AS version, to_regclass('users') AS users");
    check(true, 'PostgreSQL connected (version ' + result.rows[0].version + ')');
    check(Boolean(result.rows[0].users), 'Schema migrated (npm run db:migrate)');
  } catch { check(false, 'PostgreSQL connection/schema — check the service and DATABASE_URL'); }
  finally { await pool.end(); }
}
console.log('\nWindows exports require Edge or Chrome and HTTPS (or localhost).');
process.exitCode = failed ? 1 : 0;
