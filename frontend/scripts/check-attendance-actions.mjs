import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5176';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const gates = new Set();
const gate = () => {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  const pending = { promise, release: () => { gates.delete(pending); release(); } };
  gates.add(pending);
  return pending;
};
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const grid = month => {
  const dates = [1, 2].map(day => ({ key: `${month}-${String(day).padStart(2, '0')}`, day, label: `${day}`, dayName: 'Mon', isFuture: false }));
  return {
    month, monthLabel: month, workingDays: 2, dates,
    rows: Array.from({ length: 21 }, (_, i) => ({
      trainer: { _id: `attendance-trainer-${i}`, employeeId: String(150000 + i), name: `Attendance trainer ${i + 1}` },
      days: Object.fromEntries(dates.map(date => [date.key, { attendanceType: 'oif', oifNumber: '12345', mockPrepHours: 0, classHandlingHours: 2, foodAllowance: '', classHoursEditable: true }])),
      totals: { mockPrepHours: 0, classHandlingHours: 4, oifDays: 2, leaveDays: 0, replacementRequiredDays: 0 },
    })),
  };
};
let checks = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(u => localStorage.setItem('toms_user', JSON.stringify(u)), user);
  const requests = [], writes = [], heldMonths = new Map();
  const savedCells = new Map();
  const writeWaiters = new Map();
  let holdNewMonths = false;
  const waitForWrites = count => {
    if (writes.length >= count) return Promise.resolve();
    let timer;
    return new Promise((resolve, reject) => {
      writeWaiters.set(count, resolve);
      timer = setTimeout(() => reject(new Error(`Expected ${count} attendance writes; received ${writes.length}`)), 15000);
    }).finally(() => clearTimeout(timer));
  };
  await context.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    requests.push({ path, method: request.method(), month: url.searchParams.get('month') });
    try {
      if (path === '/attendance/trainer-grid') {
        const month = url.searchParams.get('month');
        if (holdNewMonths) {
          const pending = gate();
          heldMonths.set(month, pending);
          await pending.promise;
        }
        const data = grid(month);
        for (const row of data.rows) for (const date of data.dates) {
          const saved = savedCells.get(`${row.trainer._id}|${date.key}`);
          if (saved) row.days[date.key] = { ...row.days[date.key], ...saved };
        }
        return await route.fulfill({ json: data });
      }
      if (path === '/attendance/trainer-daily') {
        const pending = gate();
        const write = { ...pending, payload: request.postDataJSON(), fail: false };
        writes.push(write);
        for (const [count, resolve] of writeWaiters) if (writes.length >= count) { writeWaiters.delete(count); resolve(); }
        await pending.promise;
        if (write.fail) return await route.fulfill({ status: 409, json: { message: 'Synthetic attendance save conflict' } });
        const saved = { ...write.payload, id: `saved-${writes.indexOf(write)}`, classHoursEditable: true, isOnLeave: false, isSundayWeekOff: false, isOfficialHoliday: false, isHolidayOff: false, isDefaultWeekOff: false };
        savedCells.set(`${saved.trainer}|${saved.date}`, saved);
        return await route.fulfill({ json: saved });
      }
      return await route.fulfill({ json: fixture(path, url.searchParams) });
    } catch (error) {
      if (!context.browser()?.isConnected()) return;
      // Context disposal cancels held fixture requests, never forwards them.
      if (!/closed|disposed|canceled|cancelled/i.test(error.message)) throw error;
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/trainers?tab=attendance`);
  const panel = page.getByRole('region', { name: 'Monthly trainer attendance' });
  const rows = panel.locator('.trainer-attendance-grid tbody tr');
  await rows.first().waitFor();
  assert.equal(await rows.count(), 10);
  await tick(page);
  assert.equal(requests.filter(request => request.path === '/attendance/trainer-grid').length, 1);
  await panel.getByRole('button', { name: 'Next', exact: true }).click();
  await panel.getByText('Attendance trainer 11', { exact: true }).waitFor();
  await panel.getByRole('button', { name: 'Next', exact: true }).click();
  await panel.getByText('Attendance trainer 21', { exact: true }).waitFor();
  assert.equal(await rows.count(), 1);
  await panel.getByRole('searchbox', { name: 'Filter trainers in attendance grid' }).fill('150020');
  await panel.getByText('Attendance trainer 21', { exact: true }).waitFor();
  assert.equal(await rows.count(), 1);
  await panel.getByRole('searchbox', { name: 'Filter trainers in attendance grid' }).fill('');
  await panel.getByText('Attendance trainer 1', { exact: true }).waitFor();
  assert.equal(await rows.count(), 10);
  checks++;
  console.log('Pagination/search and initial read coalescing passed');

  const first = rows.nth(0).locator('.trainer-attendance-oif-input').first();
  const second = rows.nth(1).locator('.trainer-attendance-oif-input').first();
  await first.focus();
  await first.press('Tab');
  await tick(page);
  assert.equal(writes.length, 0, 'unchanged blur must not write attendance');
  await first.fill('43210');
  await first.press('Tab');
  await waitForWrites(1);
  console.log('First edited attendance save received');
  await page.waitForFunction(() => document.querySelector('.trainer-attendance-grid tbody input')?.disabled);
  assert.equal(await first.isDisabled(), true);
  assert.equal(await second.isEnabled(), true);
  assert.equal(await panel.getByRole('button', { name: 'Refresh', exact: true }).isDisabled(), true);
  assert.equal(await panel.getByRole('button', { name: 'Previous month', exact: true }).isDisabled(), true);
  // Repeated blur bypasses the UI's disabled control; the same payload is coalesced.
  await first.evaluate(input => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
  await tick(page);
  assert.equal(writes.length, 1);
  await second.fill('54321');
  await second.press('Tab');
  await waitForWrites(2);
  assert.match(await panel.locator('.trainer-attendance-summary [role="status"]').innerText(), /Saving 2 attendance entries/);
  assert.equal(writes[0].payload.trainer, 'attendance-trainer-0');
  assert.equal(writes[1].payload.trainer, 'attendance-trainer-1');
  await mkdir('.tmp', { recursive: true });
  await page.screenshot({ path: '.tmp/attendance-pending.png' });
  writes[1].release();
  await page.waitForFunction(() => !document.querySelectorAll('.trainer-attendance-grid tbody tr')[1]?.querySelector('input')?.disabled);
  assert.equal(await first.isDisabled(), true, 'finishing another row must not unlock this save');
  writes[0].fail = true;
  writes[0].release();
  await page.waitForFunction(() => !document.querySelector('.trainer-attendance-grid tbody input')?.disabled);
  assert.equal(await first.inputValue(), '43210');
  const refreshed = page.waitForResponse(response => response.url().includes('/attendance/trainer-grid'));
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  await refreshed;
  await page.waitForFunction(() => !document.querySelector('.trainer-attendance-grid tbody input')?.disabled);
  assert.equal(await first.inputValue(), '43210', 'refresh must retain the failed edit for retry');
  assert.equal(await second.inputValue(), '54321', 'refresh still loads saved server values');
  await first.focus();
  await first.press('Tab');
  await waitForWrites(3);
  writes[2].release();
  await page.waitForFunction(() => !document.querySelector('.trainer-attendance-grid tbody input')?.disabled);
  await first.focus();
  await first.press('Tab');
  await tick(page);
  assert.equal(writes.length, 3, 'successful retry establishes the new unchanged baseline');
  checks++;
  console.log('No-op, duplicate, independent save and failure retry checks passed');

  holdNewMonths = true;
  const monthRequest = () => page.waitForRequest(request => request.url().includes('/api/attendance/trainer-grid'));
  let observed = monthRequest();
  await panel.getByRole('button', { name: 'Previous month', exact: true }).click();
  const older = new URL((await observed).url()).searchParams.get('month');
  observed = monthRequest();
  await panel.getByRole('button', { name: 'Previous month', exact: true }).click();
  const oldest = new URL((await observed).url()).searchParams.get('month');
  assert.notEqual(older, oldest);
  heldMonths.get(oldest).release();
  await panel.locator('.trainer-attendance-summary').getByText(oldest, { exact: true }).waitFor();
  heldMonths.get(older).release();
  await tick(page);
  assert.equal(await panel.locator('.trainer-attendance-summary').getByText(oldest, { exact: true }).count(), 1);
  assert.equal(await panel.locator(`[data-date-scroll-anchor="${oldest}-01"]`).count(), 1);
  checks++;
  console.log('Out-of-order month checks passed');

  const requestStart = requests.length;
  const plpResponse = page.waitForResponse(response => response.url().includes('/api/plp') && response.request().method() === 'GET');
  await page.goto(`${base}/performance?tab=plp`);
  await page.getByRole('tab', { name: 'PLP', exact: true }).waitFor();
  await plpResponse;
  assert.equal(requests.slice(requestStart).some(request => request.path.startsWith('/feedback')), false, 'direct PLP link must not fetch the hidden feedback tab');
  assert.deepEqual(errors, []);
  checks++;
  await context.close();
  console.log(`${checks} attendance browser scenarios passed (pagination/search, save isolation/retry, stale month, direct PLP tab).`);
} finally {
  for (const pending of gates) pending.release();
  await browser.close();
}
