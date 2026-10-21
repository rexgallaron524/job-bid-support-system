import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3100';
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.slice(1).startsWith('job_support_test')) throw new Error('Set TEST_DATABASE_URL to a dedicated job_support_test* database. Point the test server at that same database.');
const pool = new pg.Pool({ connectionString });
const suffix = randomBytes(6).toString('hex');
const password = 'test-password-' + randomBytes(24).toString('hex');
const managerEmail = 'manager-' + suffix + '@example.test';
const email = 'user-' + suffix + '@example.test';
const otherEmail = 'other-' + suffix + '@example.test';
const managerId = randomUUID();
const { hashPassword, tokenHash } = await import('../lib/password.mjs');
let checks = 0;
async function call(path, { cookie, method = 'GET', body, expected = 200, origin = base, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' && origin ? { Origin: origin } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  assert.equal(response.status, expected, method + ' ' + path + ': ' + text.slice(0, 300)); checks++;
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { data, response };
}
const login = async loginEmail => {
  const result = await call('/api/auth/login', { method: 'POST', body: { email: loginEmail, password } });
  const cookie = result.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie); assert.match(result.response.headers.get('set-cookie'), /HttpOnly/i); assert.match(result.response.headers.get('set-cookie'), /SameSite=lax/i);
  return cookie;
};
try {
  // This is a dedicated test database: reset persistent throttles between runs.
  await pool.query('DELETE FROM auth_limits');
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,status,created_at) VALUES ($1,$2,'Test manager',$3,'manager','approved',$4)", [managerId, managerEmail, await hashPassword(password), new Date().toISOString()]);
  await call('/api/jobs', { expected: 401, headers: { 'x-openai-user-id': managerId } });
  await call('/api/manager/users', { expected: 401 });
  await call('/api/auth/signup', { method: 'POST', body: { email, password, name: 'Test user', privacyAccepted: false }, expected: 400 });
  await call('/api/auth/signup', { method: 'POST', body: { email, password, name: 'Test user', privacyAccepted: true, role: 'manager' }, expected: 400 });
  for (const address of [email, otherEmail]) await call('/api/auth/signup', { method: 'POST', body: { email: address, password, name: 'Test user', privacyAccepted: true }, expected: 202 });
  await call('/api/auth/login', { method: 'POST', body: { email, password }, expected: 403 });
  await call('/api/auth/login', { method: 'POST', body: { email: managerEmail, password }, origin: 'https://evil.example', expected: 403 });
  await call('/api/auth/login', { method: 'POST', body: { email: managerEmail, password }, origin: null, expected: 403 });
  const manager = await login(managerEmail);
  const accounts = (await call('/api/manager/users', { cookie: manager })).data;
  assert.equal(JSON.stringify(accounts).includes('passwordHash'), false);
  const userId = accounts.find(a => a.email === email).id;
  const otherId = accounts.find(a => a.email === otherEmail).id;
  for (const id of [userId, otherId]) await call('/api/manager/users/' + id, { cookie: manager, method: 'PATCH', body: { status: 'approved' } });
  const user = await login(email), other = await login(otherEmail);
  await pool.query("INSERT INTO auth_limits(key,count,resets_at) VALUES ($1,10,now()+interval '15 minutes')", [tokenHash('login-email:rate-' + email)]);
  await call('/api/auth/login', { method: 'POST', body: { email: 'rate-' + email, password }, expected: 429 });
  const managerPage = "/" + (process.env.TEST_MANAGER_PATH || "manager");
  await call(managerPage, { expected: 307 });
  await call(managerPage, { cookie: user, expected: 404 });
  await call(managerPage, { cookie: manager });
  await call('/api/manager/users', { cookie: user, expected: 403 });
  await call('/api/manager/users/' + otherId, { cookie: user, method: 'DELETE', body: { confirmationEmail: otherEmail }, expected: 403 });
  await call('/api/preferences', { cookie: user, method: 'PATCH', body: { theme: 'light' } });
  assert.equal((await pool.query('SELECT theme FROM users WHERE id=$1', [userId])).rows[0].theme, 'light');
  const fields = { url: 'https://acme.example/jobs/' + suffix + '?utm_source=test', title: 'Engineer', company: 'Acme', description: 'Build useful things.\nUnicode: 日本語', notes: 'Recruiter notes' };
  const job = (await call('/api/jobs', { cookie: user, method: 'POST', body: fields, expected: 201 })).data;
  assert.match(job.shortId, /^[0-9a-f]{8}$/);
  const endpoint = '/api/jobs/' + job.id;
  await call('/api/jobs', { cookie: user, method: 'POST', body: { ...fields, url: fields.url.replace('?utm_source=test', '') }, expected: 409 });
  await call('/api/jobs', { cookie: other, method: 'POST', body: fields, expected: 201 });
  await call(endpoint, { cookie: other, method: 'PATCH', body: fields, expected: 404 });
  await call(endpoint, { cookie: manager, method: 'PATCH', body: fields, expected: 404 });
  await call(endpoint, { cookie: manager, method: 'DELETE', expected: 404 });
  const inspected = (await call('/api/manager/jobs?userId=' + userId, { cookie: manager })).data;
  assert.equal(inspected[0].description, fields.description);
  await call('/api/manager/jobs?userId=' + userId, { cookie: other, expected: 403 });
  await call('/api/manager/jobs/' + job.id, { cookie: manager, method: 'PATCH', body: fields, expected: 404 });
  const fake = new FormData(); fake.append('file', new File(['not pdf'], 'resume.pdf'));
  await call(endpoint + '/resume', { cookie: user, method: 'POST', body: fake, expected: 400 });
  const bytes = '%PDF-1.7\nTest resume\n%%EOF';
  const form = new FormData(); form.append('file', new File([bytes], 'engineer.pdf'));
  await call(endpoint + '/resume', { cookie: user, method: 'POST', body: form });
  assert.equal((await call(endpoint + '/resume', { cookie: user })).data, bytes);
  assert.equal((await call('/api/manager/jobs/' + job.id + '/resume', { cookie: manager })).data, bytes);
  await call(endpoint + '/resume', { cookie: other, expected: 404 });
  await call('/api/manager/jobs/' + job.id + '/resume', { cookie: other, expected: 403 });
  assert.equal((await pool.query('SELECT data FROM resumes WHERE job_id=$1', [job.id])).rows[0].data.toString(), bytes);
  const applied = (await call(endpoint, { cookie: user, method: 'PATCH', body: { action: 'setStatus', status: 'Applied' } })).data;
  const interview = (await call(endpoint, { cookie: user, method: 'PATCH', body: { action: 'setStatus', status: 'Interview' } })).data;
  assert.ok(applied.appliedAt); assert.equal(applied.appliedAt, interview.appliedAt);
  await call(endpoint, { cookie: user, method: 'PATCH', body: { action: 'setStatus', status: 'Saved' }, expected: 400 });
  const undone = (await call(endpoint, { cookie: user, method: 'PATCH', body: { action: 'undoApplied' } })).data;
  assert.equal(undone.appliedAt, null);
  await call(endpoint, { cookie: user, method: 'PATCH', body: { ...fields, userId: otherId }, expected: 400 });
  await call(endpoint, { cookie: user, method: 'PATCH', body: fields, origin: 'https://evil.example', expected: 403 });
  // The canonical URL index accepts the documented 4,000-character URL bound.
  await call('/api/jobs', { cookie: user, method: 'POST', body: { ...fields, url: 'https://acme.example/jobs?q=' + 'x'.repeat(3900) }, expected: 201 });
  await call('/api/manager/users/' + userId, { cookie: manager, method: 'PATCH', body: { status: 'suspended' } });
  await call('/api/jobs', { cookie: user, expected: 401 });
  await call('/api/manager/users/' + userId, { cookie: manager, method: 'PATCH', body: { status: 'approved' } });
  await call('/api/jobs', { cookie: user, expected: 401 });
  const userAgain = await login(email);
  await call('/api/manager/users/' + managerId, { cookie: manager, method: 'DELETE', body: { confirmationEmail: managerEmail }, expected: 403 });
  await call('/api/manager/users/' + userId, { cookie: manager, method: 'DELETE', body: { confirmationEmail: 'wrong@example.test' }, expected: 400 });
  await call('/api/manager/users/' + userId, { cookie: manager, method: 'DELETE', body: { confirmationEmail: email } });
  for (const [table, column, id] of [['users','id',userId],['jobs','user_id',userId],['resumes','job_id',job.id],['sessions','user_id',userId]]) {
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM ' + table + ' WHERE ' + column + '=$1', [id])).rows[0].count, 0);
  }
  await call('/api/jobs', { cookie: userAgain, expected: 401 });
  await call('/api/manager/jobs/' + job.id + '/resume', { cookie: manager, expected: 404 });
  await call('/api/auth/password', { cookie: other, method: 'POST', body: { currentPassword: password, newPassword: password + '-new' } });
  await call('/api/jobs', { cookie: other, expected: 401 });
  await call('/api/auth/logout', { cookie: manager, method: 'POST' });
  await call('/api/manager/users', { cookie: manager, expected: 401 });
  console.log('Passed ' + checks + ' API checks against real PostgreSQL (approval, isolation, manager permissions, resumes, CSRF, sessions, cascade deletion).');
} finally {
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [[managerEmail, email, otherEmail]]);
  await pool.end();
}
