import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJobUrl, inferCompany, transitionStatus, isValidDate, resumeFormat, deadlineLabel, DOCX_TYPE } from '../lib/domain.ts';

test('tracking variations normalize to the same posting', () => {
  assert.equal(normalizeJobUrl('http://www.Example.com/jobs/42/?utm_source=mail&gclid=abc&job_id=42'), normalizeJobUrl('https://example.com/jobs/42?job_id=42'));
});
test('distinct job IDs and hash routes are retained', () => {
  assert.notEqual(normalizeJobUrl('https://example.com/jobs?id=1'), normalizeJobUrl('https://example.com/jobs?id=2'));
  assert.notEqual(normalizeJobUrl('https://example.com/#/jobs/1'), normalizeJobUrl('https://example.com/#/jobs/2'));
  assert.equal(normalizeJobUrl('https://example.com/jobs?b=2&a=1#description'), 'https://example.com/jobs?a=1&b=2');
});
test('unsafe protocols, embedded credentials, and incomplete URLs are rejected', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'ftp://example.com/a', 'https://user:password@example.com/job', 'example.com', 'https://localhost/job']) assert.throws(() => normalizeJobUrl(value));
});
test('company suggestion recognizes job boards and country domains', () => {
  assert.equal(inferCompany('https://jobs.lever.co/linear/123'), 'Linear');
  assert.equal(inferCompany('https://job-boards.greenhouse.io/figma/jobs/42'), 'Figma');
  assert.equal(inferCompany('https://jobs.ashbyhq.com/acme-labs/42'), 'Acme Labs');
  assert.equal(inferCompany('https://jobs.acme.co.uk/123'), 'Acme');
  assert.equal(inferCompany('https://acme.wd5.myworkdayjobs.com/en-US/jobs/42'), 'Acme');
  assert.equal(inferCompany('https://www.linkedin.com/jobs/view/123'), '');
});
test('application date survives progress and requires explicit undo', () => {
  const first = '2026-10-20T10:00:00.000Z';
  let record = transitionStatus({ status: 'Saved', appliedAt: null }, 'Applied', first);
  for (const next of ['Interview', 'Offer', 'Rejected', 'Withdrawn']) {
    record = transitionStatus(record, next, '2026-10-21T10:00:00.000Z');
    assert.equal(record.appliedAt, first);
  }
  assert.throws(() => transitionStatus(record, 'Saved', first), /Undo/);
  assert.throws(() => transitionStatus(record, 'Preparing', first), /Undo/);
  assert.equal(transitionStatus({ status: 'Saved', appliedAt: null }, 'Preparing', first).appliedAt, null);
});
test('calendar dates reject impossible days and support leap years', () => {
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(isValidDate('2026-10-20'), true);
  assert.equal(isValidDate('10/20/2026'), false);
});
test('resume detection checks contents and extension', () => {
  const bytes = (value) => new TextEncoder().encode(value);
  assert.equal(resumeFormat('resume.PDF', bytes('%PDF-1.7\n')), 'application/pdf');
  assert.equal(resumeFormat('resume.pdf', bytes('<html>fake</html>')), null);
  assert.equal(resumeFormat('resume.exe', bytes('%PDF-1.7')), null);
  assert.equal(resumeFormat('resume.docx', bytes('PK\x03\x04random')), null);
  assert.equal(resumeFormat('resume.docx', bytes('PK\x03\x04[Content_Types].xml word/document.xml')), DOCX_TYPE);
});
test('deadline labels use UTC dates', () => {
  assert.equal(deadlineLabel('2026-10-19', '2026-10-20'), 'Overdue');
  assert.equal(deadlineLabel('2026-10-20', '2026-10-20'), 'Today');
  assert.equal(deadlineLabel('2026-10-21', '2026-10-20'), 'Tomorrow');
  assert.equal(deadlineLabel('2026-10-25', '2026-10-20'), 'In 5 days');
});
