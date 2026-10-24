import assert from 'node:assert/strict';

async function checkLayout(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: page must fit the viewport`);
}

async function checkText(page, label) {
  const failures = await page.evaluate(() => {
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const blend = (front, back) => front.slice(0, 3).map((channel, i) => channel * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
    const luminance = color => color.slice(0, 3).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const background = element => {
      const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
      return ancestors.reduce((color, node) => blend(rgb(getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
    };
    const failures = [];
    for (const node of document.querySelectorAll('main *, .sidebar *, .topbar *')) {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.right <= 0 || rect.left >= innerWidth || style.visibility === 'hidden' || node.closest('[hidden], :disabled, svg, .skeleton')) continue;
      // Test rendered HTML text, not icons, hidden labels, or disabled controls.
      const text = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join('').trim();
      if (!text || node.classList.contains('sr-only')) continue;
      const size = parseFloat(style.fontSize);
      if (size < 14) failures.push({ text: text.slice(0, 60), issue: 'font below 14px', size });
      const bg = background(node), fg = blend(rgb(style.color), bg), a = luminance(fg), b = luminance(bg);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const minimum = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
      if (ratio + .01 < minimum) failures.push({ text: text.slice(0, 60), issue: 'contrast', ratio: ratio.toFixed(2), fg: style.color, bg });
    }
    return failures;
  });
  assert.deepEqual(failures, [], `${label}: readable text size and contrast`);
  const cues = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const luminance = color => {
      let hex = color.trim().replace('#', '');
      if (hex.length === 3) hex = [...hex].map(character => character + character).join('');
      return (hex.match(/../g) || []).map(channel => parseInt(channel, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    };
    const panel = luminance(style.getPropertyValue('--panel')), input = luminance(style.getPropertyValue('--input'));
    const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    return ['saved', 'applied', 'interview_completed', 'offer', 'rejected', 'withdrawn'].map(kind => ({ kind, ratio: ratio(luminance(style.getPropertyValue('--chart-' + kind)), panel) })).concat([{ kind: 'input boundary', ratio: ratio(luminance(style.getPropertyValue('--input-border')), input) }]).filter(cue => cue.ratio < 3);
  });
  assert.deepEqual(cues, [], `${label}: chart colors and input boundaries require 3:1 contrast`);
}

export async function checkDashboardReadability(page) {
  await page.locator('.chart-canvas svg').waitFor();
  await checkText(page, 'Dark dashboard');
  assert.ok(await page.locator('body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 16));
  assert.equal(await page.getByLabel('Chart metrics', { exact: true }).inputValue(), 'primary');
  const period = page.getByLabel('Chart period', { exact: true });
  await period.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  assert.ok(await period.evaluate(node => parseFloat(getComputedStyle(node).outlineWidth) >= 3), 'Keyboard controls must have a visible focus outline');
  await page.waitForFunction(() => document.querySelector('.chart-selection>strong').textContent === document.querySelector('select[aria-label="Chart period"]').value);
  await page.getByRole('button', { name: 'Next chart period', exact: true }).click();
  assert.ok(await page.getByRole('button', { name: 'Previous chart period', exact: true }).isEnabled());
  await page.getByText('View exact numbers by day', { exact: true }).click();
  assert.equal(await page.locator('.activity-values thead th').count(), 7);
  assert.ok(await page.locator('.activity-table-header th').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 16));
  const controls = await page.locator('.activity-dashboard button:not(:disabled), .activity-dashboard select').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().width && node.getBoundingClientRect().height).map(node => ({ name: node.getAttribute('aria-label') || node.textContent, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })).filter(rect => rect.width < 44 || rect.height < 44));
  assert.deepEqual(controls, [], 'Dashboard controls must have 44px targets');
  for (const width of [1024, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => { const node = document.querySelector('.chart-canvas'); return Math.abs(node.clientWidth - node.querySelector('svg').getAttribute('width')) < 2; });
    await checkLayout(page, `Dashboard ${width}px`);
    const labelSizes = await page.locator('.chart-canvas text').evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize) * node.getScreenCTM().a));
    assert.ok(labelSizes.every(size => size >= 13.9), `Chart labels must remain 14px at ${width}px`);
    if (width === 390) {
      const bar = page.locator('.chart-hit').first();
      await bar.scrollIntoViewIfNeeded();
      const expectedDate = (await bar.locator('title').textContent()).slice(0, 10);
      const rect = await bar.boundingBox();
      await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.waitForFunction(date => document.querySelector('.chart-selection>strong')?.textContent === date, expectedDate);
    }
  }
  // Browser default text enlargement, plus narrow viewports, tests reflow without
  // pretending CDP pinch zoom is actual browser zoom.
  await page.setViewportSize({ width: 640, height: 900 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Close navigation', exact: true }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Close navigation', exact: true }).evaluate(node => node === document.activeElement));
  await page.keyboard.press('Shift+Tab');
  assert.ok(await page.locator('.sidebar').evaluate(node => node.contains(document.activeElement)), 'Mobile menu must trap focus');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open navigation');
  assert.ok(await page.locator('.sidebar').evaluate(node => node.inert), 'Closed mobile menu must leave the keyboard order');
  for (const percent of [125, 150, 200]) {
    await page.evaluate(value => { document.documentElement.style.fontSize = value + '%'; }, percent);
    await checkLayout(page, `${percent}% text enlargement`);
    assert.ok(await page.getByLabel('Activity date range', { exact: true }).evaluate((node, value) => parseFloat(getComputedStyle(node).fontSize) >= 16 * value / 100, percent));
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => animation.finished.catch(() => {}))); });
  await checkText(page, 'Light dashboard');
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => animation.finished.catch(() => {}))); });
  // Exercise long exact tables and both pagination directions with zero periods.
  const thirtyDays = page.waitForResponse(response => response.url().includes('/api/activity?') && response.ok());
  await page.getByLabel('Activity date range', { exact: true }).selectOption('30days');
  await thirtyDays;
  await page.locator('.chart-canvas svg').waitFor();
  await page.getByText('View exact numbers by day', { exact: true }).click();
  assert.equal(await page.locator('.activity-numbers tbody tr').count(), 10);
  await page.getByRole('button', { name: 'Next numbers page', exact: true }).click();
  await page.getByRole('button', { name: 'Previous numbers page', exact: true }).click();
  await page.getByLabel('Periods per page', { exact: true }).selectOption('20');
  assert.equal(await page.locator('.activity-numbers tbody tr').count(), 20);
  await page.getByLabel('Periods per page', { exact: true }).selectOption('50');
  assert.equal(await page.locator('.activity-numbers tbody tr').count(), 30);
  await page.locator('.activity-values tbody tr').nth(15).scrollIntoViewIfNeeded();
  const stickyHeader = await page.locator('.activity-table-header').boundingBox();
  assert.ok(Math.abs(stickyHeader.y) <= 1, 'Exact table headings must stick while the page scrolls');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('region', { name: 'Exact activity counts', exact: true }).evaluate(node => { node.scrollLeft = 300; });
  await page.waitForFunction(() => document.querySelector('.activity-table-header').scrollLeft === document.querySelector('.activity-numbers .table-scroll').scrollLeft);
  const columns = await page.evaluate(() => {
    const headers = [...document.querySelectorAll('.activity-table-header th')].map(node => node.getBoundingClientRect());
    const cells = [...document.querySelectorAll('.activity-values tbody tr:first-child>*')].map(node => node.getBoundingClientRect());
    return headers.map((rect, index) => ({ headerX: rect.x, cellX: cells[index].x, headerWidth: rect.width, cellWidth: cells[index].width }));
  });
  assert.ok(columns.every(rect => Math.abs(rect.headerX - rect.cellX) < 2 && Math.abs(rect.headerWidth - rect.cellWidth) < 2), 'Sticky headers must align with horizontally scrolled values: ' + JSON.stringify(columns));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Chart metrics', { exact: true }).selectOption('all');
  assert.equal(await page.locator('.activity-legend>span').count(), 6);
  const sevenDays = page.waitForResponse(response => response.url().includes('/api/activity?') && response.ok());
  await page.getByLabel('Activity date range', { exact: true }).selectOption('7days');
  await sevenDays;
  await page.locator('.chart-canvas svg').waitFor();
}

export async function checkWorkspaceReadability(page) {
  await checkText(page, 'Application list');
  await page.setViewportSize({ width: 320, height: 900 });
  await checkLayout(page, 'Application list 320px');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await checkLayout(page, 'Expanded application filters 320px');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const table = page.getByRole('region', { name: 'Job opportunities', exact: true });
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[aria-label="Job opportunities"]').scrollLeft > 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
}

export async function checkProfileReadability(page) {
  await checkText(page, 'Profile');
  assert.ok(await page.getByLabel('Full name', { exact: true }).evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 16));
  await page.getByRole('link', { name: 'Work experience', exact: true }).click();
  assert.ok(await page.locator('#profile-experience').evaluate(node => { const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.top < innerHeight; }), 'Section links must bring the heading into view');
  await page.setViewportSize({ width: 320, height: 900 });
  await checkLayout(page, 'Profile 320px');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await checkLayout(page, 'Profile 320px with 200% text');
  const clippedButtons = await page.locator('.master-profile .btn').evaluateAll(nodes => nodes.filter(node => {
    const rect = node.getBoundingClientRect(), panel = node.closest('.panel').getBoundingClientRect();
    return rect.left < panel.left || rect.right > panel.right || node.scrollWidth > node.clientWidth + 1;
  }).map(node => node.textContent));
  assert.deepEqual(clippedButtons, [], 'Enlarged profile buttons must wrap without being clipped');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

export async function checkOpportunityReadability(page) {
  await page.setViewportSize({ width: 320, height: 900 });
  await checkLayout(page, 'Opportunity 320px');
  assert.ok(await page.getByRole('dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Opportunity content must fit the dialog width');
  await page.getByRole('navigation', { name: 'Opportunity sections', exact: true }).getByRole('link', { name: 'Description', exact: true }).click();
  assert.ok(await page.locator('#opportunity-description').evaluate(node => {
    const header = document.querySelector('.modal-header').getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    return rect.top >= header.bottom && rect.top < innerHeight;
  }), 'Opportunity links must reveal the section below the sticky dialog header');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  assert.ok(await page.getByRole('dialog').evaluate(node => node.contains(document.activeElement)), 'Dialog must retain keyboard focus');
  await page.setViewportSize({ width: 1440, height: 1000 });
}
