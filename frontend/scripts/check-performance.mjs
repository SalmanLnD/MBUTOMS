import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5176';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const output = process.env.PERFORMANCE_OUTPUT || '.tmp/performance-current.json';
const trainerCount = 60;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const trials = [];
try {
  for (let trial = 0; trial < 3; trial++) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(u => localStorage.setItem('toms_user', JSON.stringify(u)), user);
    const requests = [];
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api/, '');
      requests.push({ path, method: route.request().method() });
      if (path === '/attendance/trainer-grid') {
        const month = url.searchParams.get('month') || '2026-11';
        const dates = Array.from({ length: 30 }, (_, i) => ({ key: `${month}-${String(i + 1).padStart(2, '0')}`, day: i + 1, label: String(i + 1), dayName: 'Mon', isFuture: false }));
        const rows = Array.from({ length: trainerCount }, (_, i) => ({
          trainer: { _id: `perf-trainer-${i}`, name: `Performance trainer ${i + 1}`, employeeId: String(150000 + i) },
          days: Object.fromEntries(dates.map(date => [date.key, { attendanceType: 'oif', oifNumber: '12345', mockPrepHours: 0, classHandlingHours: 2, foodAllowance: '', classHoursEditable: true }])),
          totals: { mockPrepHours: 0, classHandlingHours: 60, oifDays: 30, leaveDays: 0, replacementRequiredDays: 0 },
        }));
        return route.fulfill({ json: { month, workingDays: 30, dates, rows } });
      }
      if (path === '/attendance/trainer-daily') return route.fulfill({ json: route.request().postDataJSON() });
      return route.fulfill({ json: fixture(path, url.searchParams) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    const started = performance.now();
    await page.goto(`${base}/trainers?tab=attendance`);
    await page.locator('.trainer-attendance-grid tbody tr').first().waitFor({ timeout: 15000 }).catch(async error => {
      console.error((await page.locator('body').innerText()).slice(0, 2000));
      throw error;
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const readyMs = performance.now() - started;
    const mountedRows = await page.locator('.trainer-attendance-grid tbody tr').count();
    const inputs = await page.locator('.trainer-attendance-grid input').count();
    const editMs = [];
    for (let i = 0; i < 6; i++) {
      editMs.push(await page.evaluate(async i => {
        const input = document.querySelector('.trainer-attendance-grid tbody input');
        const start = performance.now();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, `12345${i}`);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return performance.now() - start;
      }, i));
    }
    assert.deepEqual(errors, []);
    assert.ok(mountedRows > 0 && mountedRows <= trainerCount);
    trials.push({ trial, readyMs, mountedRows, inputs, editMs, gridRequests: requests.filter(request => request.path === '/attendance/trainer-grid').length });
    await context.close();
  }
} finally { await browser.close(); }
await mkdir('.tmp', { recursive: true });
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = { base, trainerCount, days: 30, trials, medianReadyMs: median(trials.map(trial => trial.readyMs)), medianEditMs: median(trials.flatMap(trial => trial.editMs)) };
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
