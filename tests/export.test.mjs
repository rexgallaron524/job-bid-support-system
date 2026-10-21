import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportFolder, exportText } from '../lib/export.ts';
const job = { shortId: 'a1b2', company: 'Acme', createdAt: '2026-10-21T09:00:00.000Z', title: 'Engineer', description: 'First line\n第二行' };
test('exports to a stable dated company folder with a short job ID', () => {
  assert.equal(exportFolder(job), '2026-10-21-Acme-a1b2');
  assert.notEqual(exportFolder(job), exportFolder({ ...job, shortId: 'b2c3' }));
});
test('company names cannot escape or create invalid Windows paths', () => {
  const name = exportFolder({ ...job, company: ' ../Acme:<x>\\east?* |. ' });
  assert.doesNotMatch(name, /[<>:"/\\|?*\x00-\x1f]/);
  assert.ok(!name.endsWith('.') && !name.endsWith(' '));
  assert.ok(exportFolder({ ...job, company: 'x'.repeat(200) }).length < 120);
  assert.throws(() => exportFolder({ ...job, shortId: '../../other' }));
});
test('text exports preserve the title and Unicode description using Windows newlines', () => {
  assert.equal(exportText(job), 'Opportunity ID: a1b2\r\n\r\nJob title: Engineer\r\n\r\nJob description:\r\nFirst line\r\n第二行\r\n');
});
test('the ID inside the description matches its stable export folder', () => {
  assert.ok(exportFolder(job).endsWith('-' + job.shortId));
  assert.ok(exportText(job).startsWith('Opportunity ID: ' + job.shortId + '\r\n'));
});

