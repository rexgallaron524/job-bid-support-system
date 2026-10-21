// Local production Worker only. Headers emulate the trusted hosting gateway.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('API tests must use a local server.');
const run = process.env.RUN_API_TESTS === '1' ? test : test.skip;
const runId = crypto.randomUUID(), alice = `alice-${runId}`, bob = `bob-${runId}`;
async function call(user, path = '/api/jobs', method = 'GET', body) {
  const headers = user ? { 'oai-authenticated-user-id': user, 'oai-authenticated-user-email': `${user}@example.test` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(`${base}${path}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(15000) });
}
const draft = { url: `https://example.com/jobs/${runId}?utm_source=test`, company: 'Example', title: 'Test engineer', description: 'A private description', deadline: '2026-12-01' };
run('authentication, owner isolation, duplicates, status flow, and private resumes', async () => {
  let a, b;
  try {
    assert.equal((await call(null)).status, 401);
    let response = await call(alice, '/api/jobs', 'POST', draft);
    assert.equal(response.status, 201, await response.clone().text()); a = await response.json();
    assert.equal(a.appliedAt, null); assert.equal('userId' in a, false); assert.equal('resumeKey' in a, false);
    response = await call(alice, '/api/jobs', 'POST', { ...draft, url: draft.url.replace('?utm_source=test', '?gclid=abc') });
    assert.equal(response.status, 409, await response.clone().text());
    response = await call(bob, '/api/jobs', 'POST', draft);
    assert.equal(response.status, 201); b = await response.json();
    assert.deepEqual((await (await call(alice)).json()).map((j) => j.id), [a.id]);
    assert.deepEqual((await (await call(bob)).json()).map((j) => j.id), [b.id]);
    assert.equal((await call(bob, `/api/jobs/${a.id}`, 'PATCH', { action: 'setStatus', status: 'Applied' })).status, 404);
    assert.equal((await call(bob, `/api/jobs/${a.id}`, 'DELETE')).status, 404);
    assert.equal((await call(alice, `/api/jobs/${a.id}`, 'PATCH', { ...draft, userId: bob })).status, 400);
    const forged = new FormData(); forged.append('file', new Blob(['<html>bad</html>']), 'fake.pdf');
    assert.equal((await call(alice, `/api/jobs/${a.id}/resume`, 'POST', forged)).status, 400);
    const pdf = '%PDF-1.7\nprivate test resume\n%%EOF';
    const form = new FormData(); form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'tailored.pdf');
    response = await call(alice, `/api/jobs/${a.id}/resume`, 'POST', form);
    assert.equal(response.status, 200, await response.clone().text()); assert.equal((await response.json()).resumeName, 'tailored.pdf');
    for (const method of ['GET', 'DELETE', 'POST']) assert.equal((await call(bob, `/api/jobs/${a.id}/resume`, method, method === 'POST' ? form : undefined)).status, 404);
    assert.equal((await call(null, `/api/jobs/${a.id}/resume`)).status, 401);
    response = await call(alice, `/api/jobs/${a.id}/resume`);
    assert.equal(await response.text(), pdf); assert.match(response.headers.get('cache-control'), /no-store/);
    response = await call(alice, `/api/jobs/${a.id}`, 'PATCH', { action: 'setStatus', status: 'Applied' });
    const applied = await response.json(); assert.ok(applied.appliedAt);
    response = await call(alice, `/api/jobs/${a.id}`, 'PATCH', { action: 'setStatus', status: 'Interview' });
    assert.equal((await response.json()).appliedAt, applied.appliedAt);
    assert.equal((await call(alice, `/api/jobs/${a.id}`, 'PATCH', { action: 'setStatus', status: 'Saved' })).status, 400);
    response = await call(alice, `/api/jobs/${a.id}`, 'PATCH', { action: 'undoApplied' });
    const undone = await response.json(); assert.equal(undone.appliedAt, null); assert.equal(undone.status, 'Saved'); assert.equal(undone.resumeName, 'tailored.pdf');
    const csrf = await fetch(`${base}/api/jobs/${a.id}`, { method: 'DELETE', headers: { 'oai-authenticated-user-id': alice, 'oai-authenticated-user-email': 'alice@example.test', origin: 'https://attacker.example' } });
    assert.equal(csrf.status, 403);
    assert.equal((await call(alice, `/api/jobs/${a.id}`, 'DELETE')).status, 200);
    assert.equal((await call(alice, `/api/jobs/${a.id}/resume`)).status, 404); a = null;
  } finally {
    if (a) await call(alice, `/api/jobs/${a.id}`, 'DELETE');
    if (b) await call(bob, `/api/jobs/${b.id}`, 'DELETE');
  }
});
