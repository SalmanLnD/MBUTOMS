import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5178';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const odd = { _id: 'odd', academicYear: '2026-2027', parity: 'odd', lifecycle: 'current', calendarUrl: 'https://example.com/odd', startDate: '2026-08-01', endDate: '2026-12-31' };
const even = { _id: 'even', academicYear: '2026-2027', parity: 'even', lifecycle: 'draft', calendarUrl: 'https://example.com/even', startDate: '2027-01-01', endDate: '2027-05-31', programDurations: { CSE: 8 } };
const preview = { promote: 30, graduate: 0, skipped: 1, errors: [] };
const errors = [];

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript((value) => localStorage.setItem('toms_user', JSON.stringify(value)), user);
  let current = structuredClone(odd), target = structuredClone(even), revision = 1;
  const writes = [], academicReads = [];
  await context.route('**/api/**', async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '');
    if (path === '/academic-terms/context') return route.fulfill({ json: { enabled: true, currentTerm: current, terms: [current._id === 'odd' ? current : { ...odd, lifecycle: 'archived' }, target], revision } });
    if (request.method() !== 'GET') writes.push({ path, data: request.postDataJSON() });
    if (path.endsWith('/preview')) return route.fulfill({ json: preview });
    if (path.endsWith('/prepare')) { target = { ...target, preparation: preview }; return route.fulfill({ json: { preparation: preview } }); }
    if (path.endsWith('/publish')) { current = { ...target, lifecycle: 'current' }; target = current; revision += 1; return route.fulfill({ json: { currentTerm: current, revision } }); }
    if (path === '/classes') academicReads.push(request.headers()['x-academic-term']);
    return route.fulfill({ json: fixture(path, url.searchParams) });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/classes-students`);
  await page.getByLabel('Semester', { exact: true }).waitFor();
  await page.getByLabel('Semester', { exact: true }).selectOption('even');
  await page.getByText('Draft · visible only to admins', { exact: false }).waitFor();
  assert.ok(academicReads.includes('even'), 'Private selection scopes academic data');
  assert.equal(writes.length, 0, 'Viewing never publishes or promotes');
  await page.getByRole('button', { name: 'Return to current semester', exact: true }).click();
  await page.getByRole('button', { name: 'Manage academic years & semesters', exact: true }).click();
  await page.getByRole('button', { name: 'Preview promotion', exact: true }).click();
  await page.getByText('Students advancing one semester', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Prepare next semester', exact: true }).click();
  await page.getByRole('button', { name: 'Publish as current', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Publish as current for everyone', exact: true }).isDisabled(), true);
  await page.getByLabel('I reviewed the roster, dates, calendar and program completion rules.').check();
  await page.getByRole('button', { name: 'Publish as current for everyone', exact: true }).click();
  await page.getByText('Current semester published for all trainers.', { exact: true }).waitFor();
  assert.equal(writes.find((write) => write.path.endsWith('/publish')).data.expectedRevision, 1);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(await page.getByLabel('Semester', { exact: true }).inputValue(), 'even');
  await page.goto(`${base}/timetable`);
  assert.equal(await page.getByRole('link', { name: 'Academic Calendars', exact: true }).getAttribute('href'), even.calendarUrl);

  // An open portal form survives external publication until the user reloads.
  current = structuredClone(odd); target = structuredClone(even); revision = 10;
  await page.goto(`${base}/classes-students`);
  await page.getByRole('button', { name: 'Students', exact: true }).click();
  const filter = page.getByRole('button', { name: 'Student filters', exact: true });
  if (await filter.getAttribute('aria-expanded') !== 'true') await filter.click();
  await page.getByRole('button', { name: 'Add Student', exact: true }).click();
  await page.locator('input[name="name"]').fill('Unsaved student name');
  current = { ...even, lifecycle: 'current' }; target = current; revision = 11;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('heading', { name: 'The current semester changed', exact: true }).waitFor();
  assert.equal(await page.locator('input[name="name"]').inputValue(), 'Unsaved student name');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download open inputs', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'unsaved-semester-edits.json');
  await page.getByRole('button', { name: 'Load updated semester', exact: true }).click();
  assert.equal(await page.locator('input[name="name"]').count(), 0);

  const trainerContext = await browser.newContext();
  const trainer = { ...user, role: 'trainer', trainer: 'trainer-0' };
  await trainerContext.addInitScript((value) => localStorage.setItem('toms_user', JSON.stringify(value)), trainer);
  await trainerContext.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, '');
    const data = path === '/auth/me' ? trainer : path === '/academic-terms/context' ? { enabled: true, currentTerm: current, terms: [current], revision } : fixture(path, url.searchParams);
    await route.fulfill({ json: data });
  });
  const trainerPage = await trainerContext.newPage();
  await trainerPage.goto(`${base}/timetable`);
  await trainerPage.getByRole('link', { name: 'Academic Calendars', exact: true }).waitFor();
  assert.equal(await trainerPage.getByRole('button', { name: 'Manage academic years & semesters', exact: true }).count(), 0);
  assert.equal(await trainerPage.getByLabel('Viewing academic year', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  process.stdout.write('PASS academic term selection, preparation/publication, calendars, dirty portal form preservation and trainer layout\n');
} finally { await browser.close(); }
