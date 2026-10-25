import { chromium } from 'playwright-core';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
import { hashPassword } from '../lib/password.mjs';
import { checkDashboardReadability, checkWorkspaceReadability, checkProfileReadability, checkOpportunityReadability } from './readability.mjs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3100';
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.slice(1).startsWith('job_support_test')) throw new Error('Use a dedicated test database.');
const pool = new pg.Pool({ connectionString });
const id = randomUUID(), userId = randomUUID();
const email = 'browser-' + randomBytes(8).toString('hex') + '@example.test';
const password = 'browser-' + randomBytes(20).toString('hex');
const output = new URL('../outputs/qa/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await pool.query("INSERT INTO users(id,email,name,password_hash,role,status,created_at) VALUES ($1,$2,'Browser manager',$3,'manager','approved',$4),($5,$6,'Sample applicant',$3,'user','approved',$4)", [id, email, await hashPassword(password), new Date().toISOString(), userId, 'applicant-' + email]);
  const sampleUrl = 'https://acme.example/jobs/sample-' + userId;
  await pool.query("INSERT INTO jobs(id,short_id,user_id,url,canonical_url,canonical_hash,company,title,description,notes,status,applied_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$4,$5,'Acme','Backend Engineer','Build dependable services and support the team.','Recruiter call completed. Prepare for the technical interview.','Interview',$6,$6,$6)", [randomUUID(), randomBytes(4).toString('hex'), userId, sampleUrl, createHash('sha256').update(sampleUrl).digest('hex'), new Date().toISOString()]);
  await page.goto(base);
  await page.getByRole('button', { name: 'Request an account', exact: true }).click();
  await page.getByLabel('Your name').waitFor();
  assert.ok(await page.getByText('I understand the manager can view', { exact: false }).isVisible());
  await page.screenshot({ path: fileURLToPath(new URL('signup-dark.png', output)), fullPage: true });
  await page.locator('.editor-tabs').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Add a job', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add a job', exact: true }).click();
  await page.getByLabel('Job posting URL').fill('https://jobs.lever.co/acme/browser-test');
  await page.getByLabel('Job posting URL').press('Tab');
  await page.getByLabel('Job title', { exact: false }).fill('Platform Engineer');
  await page.getByRole('button', { name: 'Description & notes' }).click();
  await page.getByLabel('Job description', { exact: true }).fill('Build a reliable platform.\nUnicode: 日本語');
  await page.getByRole('button', { name: 'Save opportunity', exact: true }).click();
  await page.getByRole('button', { name: 'Export JD to folder' }).waitFor();
  await checkOpportunityReadability(page);
  const job = (await pool.query('SELECT id, short_id, created_at FROM jobs WHERE user_id=$1', [id])).rows[0];
  await page.getByRole('button', { name: 'Mark as applied', exact: true }).click();
  const utcToday = new Date().toISOString().slice(0, 10), utcYesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  for (const [name, date] of [['Technical round', utcToday], ['Recruiter round', utcYesterday], ['Duplicate test round', utcToday]]) {
    await page.getByRole('button', { name: 'Log completed interview', exact: true }).click();
    await page.getByLabel('Interview round name', { exact: true }).fill(name);
    await page.getByLabel('Interview completion date', { exact: true }).fill(date);
    await page.getByLabel('Interview notes', { exact: true }).fill('Round completed. 日本語');
    await page.getByRole('button', { name: 'Save completed interview', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Completed interview recorded.' }).waitFor();
  }
  await page.getByRole('button', { name: 'Remove interview Duplicate test round', exact: true }).click();
  await page.getByRole('button', { name: 'Remove interview record', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Interview record removed' }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const activityNavigation = page.getByRole('navigation', { name: 'Main navigation' });
  await activityNavigation.getByRole('button', { name: 'Progress dashboard', exact: true }).click();
  await page.getByLabel('Activity date range', { exact: true }).selectOption('7days');
  const interviewMetric = page.getByRole('article', { name: 'Interviews completed', exact: true }).locator('strong');
  const applicationMetric = page.getByRole('article', { name: 'Applications submitted', exact: true }).locator('strong');
  await page.waitForFunction(() => document.querySelector('article[aria-label="Interviews completed"] strong')?.textContent === '2');
  assert.equal(await applicationMetric.textContent(), '1');
  for (const group of ['week', 'month', 'day']) {
    const loaded = page.waitForResponse(response => response.url().includes('/api/activity?') && response.url().includes('groupBy=' + group) && response.status() === 200);
    await page.getByLabel('Group activity by', { exact: true }).selectOption(group); await loaded;
    await interviewMetric.waitFor(); assert.equal(await interviewMetric.textContent(), '2');
  }
  await page.getByRole('button', { name: /^More filters/ }).click();
  await page.getByLabel('Activity work arrangement', { exact: true }).selectOption('Remote');
  await page.waitForFunction(() => document.querySelector('article[aria-label="Interviews completed"] strong')?.textContent === '0');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('article[aria-label="Interviews completed"] strong')?.textContent === '2');
  await page.getByLabel('Activity type', { exact: true }).selectOption('interview_completed');
  await page.waitForFunction(() => document.querySelector('article[aria-label="Applications submitted"] strong')?.textContent === '0');
  await page.getByLabel('Activity type', { exact: true }).selectOption('all');
  await page.getByLabel('Activity date range', { exact: true }).selectOption('today');
  await page.waitForFunction(() => document.querySelector('article[aria-label="Interviews completed"] strong')?.textContent === '1');
  await page.getByLabel('Activity date range', { exact: true }).selectOption('custom');
  await page.getByLabel('Activity from date', { exact: true }).fill(utcYesterday);
  await page.getByLabel('Activity through date', { exact: true }).fill(utcYesterday);
  await page.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('article[aria-label="Applications submitted"] strong')?.textContent === '0');
  assert.equal(await interviewMetric.textContent(), '1');
  await page.getByRole('button', { name: /^More filters/ }).click();
  await page.getByLabel('Activity date range', { exact: true }).selectOption('7days');
  await page.waitForFunction(() => document.querySelector('article[aria-label="Interviews completed"] strong')?.textContent === '2');
  await page.evaluate(() => window.scrollTo(0, 0));
  await checkDashboardReadability(page);
  await page.locator('.activity-chart').screenshot({ path: fileURLToPath(new URL('activity-chart-desktop.png', output)), animations: 'disabled' });
  await page.locator('.toast').waitFor({ state: 'hidden' });
  await page.screenshot({ path: fileURLToPath(new URL('activity-desktop.png', output)), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Activity dashboard must fit mobile width');
  await page.screenshot({ path: fileURLToPath(new URL('activity-mobile.png', output)), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await activityNavigation.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: /Platform Engineer/ }).first().click();
  const folder = job.created_at.slice(0,10) + '-Acme-' + job.short_id;
  // Real browser File System handles in isolated origin storage, avoiding an OS chooser in unattended QA.
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      sessionStorage.setItem('export-picker-count', String(Number(sessionStorage.getItem('export-picker-count') || '0') + 1));
      return (await navigator.storage.getDirectory()).getDirectoryHandle('jobbid', { create: true });
    };
  });
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => {
      sessionStorage.setItem('export-picker-count', '1');
      return (await navigator.storage.getDirectory()).getDirectoryHandle('jobbid', { create: true });
    };
  });
  await page.getByRole('button', { name: 'Export JD to folder' }).click();
  await page.locator('.export-message').filter({ hasText: 'Saved in' }).waitFor();
  const exportMessage = await page.locator('.export-message').textContent();
  assert.ok(exportMessage.includes(folder), 'Unexpected export location: ' + exportMessage + '; expected ' + folder);
  const text = await page.evaluate(async folderName => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('jobbid');
    const directory = await root.getDirectoryHandle(folderName);
    const file = await (await directory.getFileHandle('jd.txt')).getFile();
    return file.text();
  }, folder);
  assert.ok(text.includes('Platform Engineer') && text.includes('日本語'));
  assert.ok(text.includes('Opportunity ID: ' + job.short_id), 'The ID inside jd.txt must match the export folder');
  // Reopen after a full reload: the actual handle must survive an IndexedDB round trip.
  await page.reload();
  await page.getByRole('button', { name: /Platform Engineer/ }).first().click();
  await page.getByRole('button', { name: 'Change export folder', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Export JD to folder', exact: true }).click();
  await page.locator('.export-message').filter({ hasText: 'Saved in' }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('export-picker-count')), '1', 'A remembered folder should not reopen the picker');

  // Permission denial must not report success or write a file. A later click may renew permission.
  await page.evaluate(() => {
    FileSystemHandle.prototype.queryPermission = async () => 'prompt';
    FileSystemHandle.prototype.requestPermission = async () => 'denied';
  });
  await page.getByRole('button', { name: 'Export JD to folder', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Folder access was not granted' }).waitFor();
  assert.equal(await page.locator('.export-message').filter({ hasText: 'Saved in' }).count(), 0);
  await page.evaluate(() => { FileSystemHandle.prototype.requestPermission = async () => 'granted'; });
  await page.getByRole('button', { name: 'Export JD to folder', exact: true }).click();
  await page.locator('.export-message').filter({ hasText: 'Saved in' }).waitFor();

  // Cancelling a replacement keeps the previously remembered folder usable.
  await page.evaluate(() => { window.showDirectoryPicker = async () => { throw new DOMException('Cancelled', 'AbortError'); }; });
  await page.getByRole('button', { name: 'Change export folder', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.export-control button').disabled);
  await page.getByRole('button', { name: 'Export JD to folder', exact: true }).click();
  await page.locator('.export-message').filter({ hasText: 'Saved in jobbid\\' }).waitFor();

  // Change the root explicitly and verify the next export writes into the new directory.
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('jobbid-changed', { create: true });
  });
  await page.getByRole('button', { name: 'Change export folder', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Export folder updated' }).waitFor();
  await page.getByRole('button', { name: 'Export JD to folder', exact: true }).click();
  await page.locator('.export-message').filter({ hasText: 'Saved in jobbid-changed\\' }).waitFor();
  assert.equal(await page.evaluate(async folderName => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('jobbid-changed');
    const directory = await root.getDirectoryHandle(folderName);
    return (await (await directory.getFileHandle('jd.txt')).getFile()).text();
  }, folder), text);

  // Storage failure must still allow a real export, with an honest persistence warning.
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => { throw new DOMException('Storage unavailable', 'QuotaExceededError'); };
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('jobbid-temporary', { create: true });
  });
  await page.getByRole('button', { name: 'Change export folder', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'could not remember it' }).waitFor();
  await page.getByRole('button', { name: 'Export JD to folder', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Saved in jobbid-temporary\\' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: /Platform Engineer/ }).first().click();
  await page.getByText('Export folder: jobbid-changed.', { exact: true }).waitFor();

  await page.evaluate(() => { window.showDirectoryPicker = undefined; });
  await page.getByRole('button', { name: 'Export JD to folder', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Open this app in Edge or Chrome' }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();

  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.getByRole('button', { name: 'My profile', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Alex Career');
  await page.getByLabel('Professional headline', { exact: true }).fill('Platform Engineer');
  await page.getByLabel('LinkedIn URL', { exact: true }).fill('https://www.linkedin.com/in/alex-example');
  await page.getByLabel('Work experience', { exact: true }).fill('Acme · Platform Engineer · 2020–Present\nBuilt reliable services. 日本語');
  await page.getByLabel('Skills', { exact: true }).fill('TypeScript, PostgreSQL, React');
  // An accidental navigation must not discard the master profile.
  page.once('dialog', dialog => dialog.dismiss());
  await navigation.getByRole('button', { name: 'All applications', exact: false }).click();
  assert.ok(await page.getByRole('heading', { name: 'My profile', exact: true }).isVisible());
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Your master profile is saved.' }).waitFor();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download profile TXT', exact: true }).click();
  const profileDownload = await downloadEvent;
  assert.equal(profileDownload.suggestedFilename(), 'profile.txt');
  const profileContent = await readFile(await profileDownload.path(), 'utf8');
  assert.ok(profileContent.includes('Alex Career') && profileContent.includes('日本語') && profileContent.includes('TypeScript'));
  await page.reload();
  await navigation.getByRole('button', { name: 'My profile', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[type="url"]')?.value === 'https://www.linkedin.com/in/alex-example');
  assert.equal(await page.getByLabel('Full name', { exact: true }).inputValue(), 'Alex Career');
  assert.ok((await page.getByLabel('Work experience', { exact: true }).inputValue()).includes('日本語'));
  await checkProfileReadability(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Profile must fit mobile width');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: fileURLToPath(new URL('profile-mobile.png', output)), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: fileURLToPath(new URL('profile-desktop.png', output)) });

  // Enough records to exercise the 50-row boundary and an incomplete last page.
  for (let n = 1; n <= 52; n++) {
    const url = 'https://pagination.example/jobs/' + id + '/' + n;
    await pool.query("INSERT INTO jobs(id,short_id,user_id,url,canonical_url,canonical_hash,company,title,created_at,updated_at) VALUES ($1,$2,$3,$4,$4,$5,'Pagination company',$6,$7,$7)", [randomUUID(), randomBytes(4).toString('hex'), id, url, createHash('sha256').update(url).digest('hex'), 'Pagination role ' + String(n).padStart(2, '0'), new Date(Date.now() + n * 1000).toISOString()]);
  }
  await page.reload();
  await navigation.getByRole('button', { name: 'All applications', exact: false }).click();
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 10);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await page.getByText('11–20 of 53 opportunities', { exact: true }).waitFor();
  await page.getByLabel('Rows per page', { exact: true }).selectOption('20');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 20);
  await page.getByText('1–20 of 53 opportunities', { exact: true }).waitFor();
  await page.getByLabel('Rows per page', { exact: true }).selectOption('50');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 50);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3);
  assert.ok(await page.getByRole('button', { name: 'Next page', exact: true }).isDisabled());
  await page.getByLabel('Search jobs').fill(job.short_id);
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
  await page.getByText('1–1 of 1 opportunities', { exact: true }).waitFor();
  await page.locator('tbody .job-cell').click();
  await page.getByText('Opportunity ID: ' + job.short_id, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await navigation.getByRole('button', { name: 'All applications', exact: false }).click();
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 50);
  assert.equal(await page.getByLabel('Rows per page', { exact: true }).inputValue(), '50', 'Page size should persist to the account');
  await checkWorkspaceReadability(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Pagination must fit mobile width');
  await page.screenshot({ path: fileURLToPath(new URL('pagination-mobile.png', output)), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigation.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.screenshot({ path: fileURLToPath(new URL('workspace-light.png', output)), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: fileURLToPath(new URL('workspace-mobile.png', output)), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Check every workspace view at the widths that exposed the reported clipping.
  for (const width of [1366, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 768 });
    for (const view of ['Overview', 'Progress dashboard', 'All applications', 'Deadlines', 'My resumes', 'My profile', 'Settings']) {
      if (width <= 900) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      const sidebar = view === 'Settings' ? page.locator('.sidebar-bottom') : page.getByRole('navigation', { name: 'Main navigation' });
      await sidebar.getByRole('button', { name: view, exact: view !== 'All applications' }).click();
      await page.getByRole('heading', { name: view, exact: true }).waitFor();
      if (view === 'Progress dashboard') await page.locator('.activity-metrics').waitFor();
      if (view === 'My profile') await page.locator('.profile-intro').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${view} must fit ${width}px viewport`);
      if (width === 1366 && view === 'Overview') {
        assert.ok(await page.locator('.table-scroll').evaluate(node => {
          const action = node.querySelector('tbody tr td:last-child')?.getBoundingClientRect();
          return action && action.right <= node.getBoundingClientRect().right + 1;
        }), 'Overview actions must be visible without sideways scrolling at desktop width');
      }
      if (width === 1366 || width === 390) {
        await page.screenshot({ path: fileURLToPath(new URL(`layout-${view.toLowerCase().replaceAll(' ', '-')}-${width}.png`, output)), animations: 'disabled' });
      }
    }
    if (width > 900) {
      await page.locator('.sidebar-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
      assert.ok(await page.locator('.brand').evaluate(node => node.getBoundingClientRect().top >= 0), 'Brand must stay visible when navigation scrolls');
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/review-manager-qa');
  await page.getByRole('heading', { name: 'People & progress' }).waitFor();
  await page.getByPlaceholder('Search name or email').fill('Sample applicant');
  await page.getByRole('button', { name: 'View process' }).click();
  await page.getByText('Master profile · Read-only', { exact: true }).click();
  await page.getByText('No master profile saved.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  await page.getByRole('heading', { name: 'Backend Engineer', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Edit details', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Delete job', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Log completed interview', exact: true }).count(), 0);
  await page.getByText('Progress dashboard · Read-only', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('article[aria-label="Interviews completed"] strong')?.textContent === '0');
  assert.equal(await page.getByRole('button', { name: 'Save completed interview', exact: true }).count(), 0);
  await page.getByText('Progress dashboard · Read-only', { exact: true }).click();
  await page.screenshot({ path: fileURLToPath(new URL('manager-light.png', output)), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: fileURLToPath(new URL('manager-mobile.png', output)), fullPage: true });
  // Another login in the same browser must choose its own export folder.
  await context.request.post(base + '/api/auth/logout', { headers: { Origin: base } });
  const applicantLogin = await context.request.post(base + '/api/auth/login', { headers: { Origin: base }, data: { email: 'applicant-' + email, password } });
  assert.ok(applicantLogin.ok());
  await page.goto(base);
  await page.getByRole('button', { name: /Backend Engineer/ }).first().click();
  await page.waitForFunction(() => !document.querySelector('.export-control button').disabled);
  assert.equal(await page.getByRole('button', { name: 'Change export folder', exact: true }).count(), 0, 'Folder preferences must be scoped to the signed-in account');
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: progress metrics, daily/weekly/monthly grouping, custom dates and activity filters, multiple completed interview rounds and removal, read-only manager progress, job save/export IDs, remembered folders, profile save/download, unsaved changes guard, 10/20/50 pagination, account isolation, themes, mobile layouts, no runtime errors.');
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('browser-failure.png', output)), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[id,userId]]);
  await pool.end();
}

