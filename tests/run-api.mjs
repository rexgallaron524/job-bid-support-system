import { createRequire } from 'node:module';
const projectRequire = createRequire(import.meta.url);
const { Miniflare } = createRequire(projectRequire.resolve('wrangler/package.json'))('miniflare');
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const runtime = new Miniflare({ modules: ['index.js', ...readdirSync('dist/server', { recursive: true }).filter((p) => /[.]m?js$/.test(p) && p !== 'index.js')].map((p) => ({ type: 'ESModule', path: resolve('dist/server', p) })), modulesRoot: resolve('dist/server'), compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], cf: false, host: '127.0.0.1', port: 8790, assets: { directory: 'dist/client', binding: 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } }, d1Databases: { DB: 'jobbid-api-qa' }, r2Buckets: ['BUCKET'] });
try {
  const db = await runtime.getD1Database('DB');
  for (const sql of readFileSync('drizzle/0000_stormy_professor_monster.sql', 'utf8').split('--> statement-breakpoint')) await db.prepare(sql.trim()).run();
  const url = await runtime.ready;
  console.log('Production Worker test runtime:', url.toString());
  const response = await fetch(new URL('/api/jobs', url), { signal: AbortSignal.timeout(15000) });
  console.log('Anonymous status:', response.status);
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', 'tests/api.test.mjs'], { env: { ...process.env, RUN_API_TESTS: '1', TEST_BASE_URL: url.origin }, stdio: 'inherit' });
    child.once('exit', resolve);
  });
  process.exitCode = exitCode || 0;
} finally { await runtime.dispose(); }
