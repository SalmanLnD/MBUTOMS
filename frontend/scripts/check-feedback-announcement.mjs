import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';
import { FEEDBACK_ANNOUNCEMENT } from '../../backend/utils/feedbackAnnouncement.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
await mkdir('.tmp/feedback-announcement', { recursive: true });
const receipts = new Set();
const contextFor = async (width, account) => {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(u => {
    localStorage.setItem('toms_token', 'test'); localStorage.setItem('toms_user', JSON.stringify(u));
    sessionStorage.setItem(`toms_device_setup_session:${u._id}:2.2.2`, 'done');
  }, account);
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '');
    let data = fixture(path, url.searchParams);
    if (path === '/auth/me') data = account;
    if (path === '/announcements/current') data = { announcement: FEEDBACK_ANNOUNCEMENT, dismissed: receipts.has(account._id), preview: false };
    if (path.endsWith('/dismiss')) { receipts.add(account._id); data = { dismissed: true }; }
    if (path === '/notifications') data = { notifications: [{ _id: 'notice', message: 'Read our TOMS feedback updates', entityPath: `/dashboard?announcement=${FEEDBACK_ANNOUNCEMENT.id}`, createdAt: new Date().toISOString() }], unreadCount: 1 };
    if (path === '/notifications/notice/read') data = { notification: { readAt: new Date().toISOString() }, unreadCount: 0 };
    await route.fulfill({ json: data });
  });
  return context;
};
try {
  for (const width of [390, 1366]) {
    const account = { ...user, _id: `announcement-${width}`, appVersion: '2.2.2' };
    let context = await contextFor(width, account), page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install(); await page.goto(base + '/dashboard');
    const modal = page.getByRole('dialog', { name: FEEDBACK_ANNOUNCEMENT.title });
    await modal.waitFor(); assert.equal(await modal.getByRole('button', { name: 'Close', exact: true }).isDisabled(), true);
    assert.equal(await modal.locator('li').count(), 9);
    await page.keyboard.press('Escape'); assert.equal(await modal.count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await page.screenshot({ path: `.tmp/feedback-announcement/${width}.png` });
    await page.clock.fastForward(5100);
    await modal.getByRole('button', { name: 'Close', exact: true }).click(); await modal.waitFor({ state: 'hidden' });
    assert.ok(receipts.has(account._id));
    await page.reload(); await page.locator('main').waitFor(); await page.clock.fastForward(1500);
    assert.equal(await modal.count(), 0);
    await page.getByRole('button', { name: /Notifications/ }).click();
    await page.getByRole('button', { name: /Read our TOMS feedback updates/ }).click();
    await modal.waitFor(); assert.equal(await modal.getByRole('button', { name: 'Close', exact: true }).isDisabled(), true);
    await page.clock.fastForward(5100); await modal.getByRole('button', { name: 'Close', exact: true }).click();
    await page.waitForURL(url => !url.searchParams.has('announcement'));
    assert.equal(new URL(page.url()).searchParams.has('announcement'), false);
    assert.deepEqual(errors, []); await context.close();
    // A fresh device/browser reads the same account receipt, without local storage history.
    context = await contextFor(width, account); page = await context.newPage();
    const loaded = page.waitForResponse(response => response.url().endsWith('/announcements/current'));
    await page.goto(base + '/dashboard'); await page.locator('main').waitFor();
    await loaded;
    assert.equal(await page.getByRole('dialog', { name: FEEDBACK_ANNOUNCEMENT.title }).count(), 0);
    await context.close();
  }
  console.log('Announcement countdown, dismissal across sessions/devices, notification reopen, and mobile/desktop layout passed.');
} finally { await browser.close(); }
