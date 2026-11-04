import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { fixture, user } from './responsive-fixtures.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5176';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
let checks = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  await page.goto(`${base}/scripts/ui-audit/async-actions.html`);
  await page.waitForFunction(() => window.pendingAudit);
  for (const mode of ['form', 'external', 'confirm']) {
    console.log(`Checking ${mode}`);
    await page.evaluate(mode => window.pendingAudit.mount(mode), mode);
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const trigger = mode === 'confirm' ? dialog.locator('.btn-danger') : page.locator('button[type="submit"]');
    await trigger.evaluate(element => { element.click(); element.click(); });
    await page.waitForFunction(key => window.pendingAudit.counters[key] === 1, mode === 'confirm' ? 'confirm' : 'submit');
    assert.equal(await trigger.isDisabled(), true);
    assert.equal(await dialog.getByRole('button', { name: 'Close', exact: true }).isDisabled(), true);
    if (mode !== 'confirm') {
      assert.equal(await page.getByRole('textbox', { name: 'Draft' }).isDisabled(), true);
      // requestSubmit bypasses the disabled submit control; the form lock must still stop it.
      await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      assert.equal(await page.evaluate(() => window.pendingAudit.counters.submit), 1);
    }
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 1);
    await page.locator('.toms-modal-overlay').click({ position: { x: 2, y: 2 }, force: true });
    assert.equal(await dialog.count(), 1);
    if (mode === 'form') {
      await page.evaluate(() => window.pendingAudit.finish('submit', true));
      await page.waitForFunction(() => !document.querySelector('form').getAttribute('aria-busy'));
      assert.equal(await page.getByRole('textbox', { name: 'Draft' }).inputValue(), 'Keep this draft');
      assert.equal(await trigger.isEnabled(), true);
      await page.getByRole('textbox', { name: 'Draft' }).press('Enter');
      await page.waitForFunction(() => window.pendingAudit.counters.submit === 2);
    }
    await page.evaluate(key => window.pendingAudit.finish(key), mode === 'confirm' ? 'confirm' : 'submit');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    checks++;
  }
  await page.evaluate(() => window.pendingAudit.mount('button'));
  await page.getByRole('button', { name: 'Action one', exact: true }).evaluate(button => { button.click(); button.click(); });
  await page.getByRole('button', { name: 'Action two', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.pendingAudit.counters), { one: 1, two: 1 });
  await page.evaluate(() => { window.pendingAudit.finish('one', true); window.pendingAudit.finish('two'); });
  await page.getByRole('button', { name: 'Focus first' }).click();
  await page.waitForFunction(() => document.activeElement?.textContent === 'Action one');
  checks++;

  // Real leave page with a held API response, not a mock React implementation.
  let finishLeave;
  let notifyLeaveWrite;
  let leaveWriteObserved = new Promise(resolve => { notifyLeaveWrite = resolve; });
  let leaveWrites = 0;
  let rejectLeave = true;
  await page.addInitScript(u => localStorage.setItem('toms_user', JSON.stringify(u)), user);
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    if (path === '/leaves' && route.request().method() === 'POST') {
      leaveWrites++;
      notifyLeaveWrite();
      await new Promise(resolve => { finishLeave = resolve; });
      return route.fulfill(rejectLeave ? { status: 409, json: { message: 'An active leave already exists for this range.' } } : { status: 201, json: { _id: 'new-leave' } });
    }
    if (path === '/trainers') {
      const data = fixture(path, url.searchParams);
      return route.fulfill({ json: { ...data, trainers: [{ ...data.trainers[0], name: 'Roja' }] } });
    }
    return route.fulfill({ json: fixture(path, url.searchParams) });
  });
  await page.goto(`${base}/leaves`);
  await page.getByRole('button', { name: 'Apply Leave', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Apply for Leave' });
  await dialog.locator('.toms-styled-select__trigger').click();
  await page.getByRole('option').filter({ hasText: 'Roja' }).click();
  await dialog.locator('textarea').fill('Synthetic duplicate-click verification');
  await dialog.locator('button[type="submit"]').evaluate(button => { button.click(); button.click(); });
  await dialog.locator('form[aria-busy="true"]').waitFor();
  await leaveWriteObserved;
  assert.equal(leaveWrites, 1);
  await dialog.locator('form').evaluate(form => form.requestSubmit());
  await page.keyboard.press('Escape');
  assert.equal(await dialog.count(), 1);
  assert.equal(leaveWrites, 1);
  await mkdir('.tmp', { recursive: true });
  await page.screenshot({ path: '.tmp/leave-pending.png' });
  finishLeave();
  await dialog.locator('form:not([aria-busy="true"])').waitFor();
  assert.equal(await dialog.locator('textarea').inputValue(), 'Synthetic duplicate-click verification');
  rejectLeave = false;
  leaveWriteObserved = new Promise(resolve => { notifyLeaveWrite = resolve; });
  await dialog.locator('button[type="submit"]').click();
  await dialog.locator('form[aria-busy="true"]').waitFor();
  await leaveWriteObserved;
  assert.equal(leaveWrites, 2);
  finishLeave();
  await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  checks++;
  console.log(`${checks} pending-action browser scenarios passed (form, external submit, confirm, independent actions, real leave retry).`);
} finally { await browser.close(); }
