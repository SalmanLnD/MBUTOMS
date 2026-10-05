import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const trainer = { ...user, role: 'trainer', trainer: 'trainer-test' };
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  for (const width of [390, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(u => {
      localStorage.setItem('toms_token', 'test'); localStorage.setItem('toms_user', JSON.stringify(u));
      localStorage.setItem(`toms_sallu_notice:${u._id}:2.2.1`, 'seen');
    }, trainer);
    const students = [
      { _id: 'student-1', name: 'Student One', rollNumber: '001', report: { attendance: 'P', marksObtained: 8, maxMarks: 20 } },
      { _id: 'student-2', name: 'Student Two', rollNumber: '002', report: { attendance: 'A', maxMarks: 10 } },
    ];
    const writes = [];
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), p = url.pathname.replace(/^\/api/, '');
      let data;
      if (p === '/auth/me') data = trainer;
      else if (p === '/student-test-reports/filter-options') data = [{ _id: 'class-1', department: 'CSE', section: 'A', currentSemester: 'III', py: 2026 }];
      else if (p === '/student-test-reports/subjects') data = [{ _id: 'subject-1', label: 'Test Subject' }];
      else if (p === '/student-test-reports/grid') data = { students, subject: { name: 'Test Subject', code: 'TS' } };
      else if (p === '/student-test-reports/bulk') {
        const body = route.request().postDataJSON(); writes.push(body);
        for (const entry of body.entries) students.find(s => s._id === entry.studentId).report = entry;
        data = { message: 'Saved' };
      } else data = fixture(p, url.searchParams);
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(base + '/classes-students');
    if (width >= 768) await page.getByRole('button', { name: 'Toggle Sallu pet', exact: true }).click();
    await page.getByRole('button', { name: 'Monthly Test Reports', exact: true }).click();
    await page.getByRole('button', { name: 'Mark Entry', exact: true }).click();
    await page.getByRole('button', { name: 'Mark entry filters', exact: true }).click();
    for (const [label, value] of [['Filter by department', 'CSE'], ['Filter by section', 'A'], ['Filter by semester', 'III']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByRole('option', { name: value, exact: true }).click();
    }
    const mark = page.getByRole('textbox', { name: 'Marks for Student One', exact: true });
    await mark.waitFor();
    assert.equal(await mark.inputValue(), '8');
    assert.equal(await page.locator('.mark-entry-save-actions button').count(), 2);
    const table = await page.locator('.table-card table').boundingBox();
    const footer = await page.locator('.mark-entry-save-actions').boundingBox();
    assert.ok(footer.y >= table.y + table.height, 'Entry actions must be below the table');
    await page.getByRole('button', { name: 'Clear All', exact: true }).click();
    assert.equal(await mark.inputValue(), '');
    assert.equal(await page.getByRole('textbox', { name: 'Max marks for Student One', exact: true }).inputValue(), '20');
    assert.equal(await page.getByRole('textbox', { name: 'Marks for Student Two', exact: true }).isEnabled(), true);
    assert.equal(writes.length, 0, 'Clearing drafts must not immediately write saved marks');
    await page.getByRole('button', { name: 'Undo Clear', exact: true }).click();
    assert.equal(await mark.inputValue(), '8');
    assert.equal(await page.getByRole('textbox', { name: 'Marks for Student Two', exact: true }).isEnabled(), false);
    await page.getByRole('button', { name: 'Clear All', exact: true }).click();
    await mark.fill('15');
    await page.getByRole('textbox', { name: 'Marks for Student Two', exact: true }).fill('7');
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/student-test-reports/bulk')),
      page.getByRole('button', { name: 'Save Marks', exact: true }).click(),
    ]);
    await page.waitForFunction(() => document.querySelector('[data-mark-entry-id="student-1"][data-mark-field="marksObtained"]')?.value === '15');
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].entries.map(({ attendance, marksObtained, maxMarks }) => ({ attendance, marksObtained, maxMarks })), [
      { attendance: 'P', marksObtained: '15', maxMarks: '20' }, { attendance: 'P', marksObtained: '7', maxMarks: '10' },
    ]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Trainer mark-entry footer, Clear All, attendance reset, retained maximums, Undo Clear and replacement save passed at desktop/mobile widths.');
} finally { await browser.close(); }
