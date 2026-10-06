import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const longTopic = 'Arrays, linked lists and dictionaries: exploring traversal, insertion, deletion and practical problem-solving examples';
const shortTopic = 'Trees';
const trainer = { ...user, role: 'trainer', trainer: 'trainer-test' };
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
await mkdir('.tmp/topic-picker', { recursive: true });
try {
  for (const width of [390, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    await context.addInitScript(({ u, dark }) => {
      localStorage.setItem('toms_token', 'test'); localStorage.setItem('toms_user', JSON.stringify(u));
      localStorage.setItem(`toms_sallu_notice:${u._id}:2.2.1`, 'seen');
      if (dark) localStorage.setItem('toms_theme', 'dark');
    }, { u: trainer, dark: width === 1366 });
    const rows = [1, 2].map(index => ({ scheduleId: `schedule-${index}`, date: '2026-10-05', trainerName: 'Test Trainer', subjectId: 'subject-test',
      branchYearSection: `CSE, Sem V - A${index}`, courseName: 'Test Subject', slot: `S${index}`, sessionStatus: 'completed', trackerStatus: 'pending',
      topicModulesCovered: [], topicOptions: [longTopic, shortTopic], completedTopics: index === 1 ? [longTopic] : [], completionClassKey: `class-${index}`, sessionStartTime: '09:00', sessionEndTime: '10:00' }));
    const writes = [];
    const requestedDates = [];
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, '');
      let data;
      if (path === '/auth/me') data = trainer;
      else if (path === '/topic-tracker/sessions') {
        requestedDates.push(url.searchParams.get('date'));
        data = { day: 'Monday', sessions: url.searchParams.get('date') === '2026-10-07' ? [] : rows };
      }
      else if (path === '/topic-tracker/entries') {
        const body = route.request().postDataJSON(); writes.push(body);
        data = { ...body, _id: 'saved-entry', completedTopics: [longTopic], completionClassKey: 'class-1' };
      } else data = fixture(path, url.searchParams);
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/topic-tracker');
    if (width >= 768) await page.getByRole('button', { name: 'Toggle Sallu pet', exact: true }).click();
    await page.getByRole('button', { name: 'Open my tracker', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: "Update today's slots", exact: true }).count(), 0);
    await page.locator('#tracker-session-date').fill('2026-10-05');
    const triggers = page.getByRole('button', { name: 'Topic / Module Covered 1', exact: true });
    await triggers.first().click();
    const completed = page.getByRole('option').filter({ hasText: longTopic });
    assert.equal(await completed.isEnabled(), true);
    assert.match(await completed.getAttribute('class'), /is-topic-completed/);
    await completed.hover();
    const guide = page.getByRole('tooltip');
    await guide.waitFor();
    assert.equal(await guide.innerText(), longTopic);
    assert.equal(await guide.locator('.topic-title-guide__heading,.topic-title-guide__text').count(), 0);
    const bounds = await guide.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 900);
    if (width === 390) assert.equal(await guide.locator('.topic-title-guide__ticker span').evaluate(el => getComputedStyle(el).animationName), 'none');
    else assert.equal(await guide.locator('.topic-title-guide__ticker span').evaluate(el => getComputedStyle(el).animationName), 'topic-title-scroll');
    await page.screenshot({ path: `.tmp/topic-picker/${width}-completed-guide.png` });
    await completed.click();
    assert.match(await triggers.first().innerText(), /Arrays, linked lists/);
    await page.locator('#tracker-session-date').fill('2026-10-07');
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await page.locator('#tracker-session-date').inputValue(), '2026-10-05');
    assert.match(await triggers.first().innerText(), /Arrays, linked lists/);
    await triggers.nth(1).click();
    assert.doesNotMatch(await page.getByRole('option').filter({ hasText: longTopic }).getAttribute('class'), /is-topic-completed/);
    await page.keyboard.press('Escape');
    await triggers.first().click();
    await page.getByRole('option', { name: shortTopic, exact: true }).hover();
    assert.equal(await page.getByRole('tooltip').innerText(), shortTopic);
    await page.keyboard.press('Escape');
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/topic-tracker/entries')),
      page.getByRole('button', { name: 'Save', exact: true }).first().click(),
    ]);
    assert.deepEqual(writes[0].topicModulesCovered, [longTopic], 'Completed topics must still be saveable for revision');
    await triggers.first().focus(); await page.keyboard.press('ArrowDown');
    await page.getByRole('listbox').waitFor();
    await page.waitForFunction(label => document.querySelector('[role="tooltip"]')?.textContent === label, longTopic);
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(label => document.querySelector('[role="tooltip"]')?.textContent === label, shortTopic);
    assert.equal(await page.getByRole('tooltip').innerText(), shortTopic);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('tooltip').count(), 0);
    await page.locator('#tracker-session-date').fill('2026-10-07');
    await page.getByText('No scheduled sessions for this day.', { exact: true }).waitFor();
    assert.equal(await page.locator('#topic-tracker-date').inputValue(), '2026-10-07');
    assert.equal(requestedDates.at(-1), '2026-10-07');
    await page.locator('#tracker-session-date').fill('2026-10-05');
    await triggers.first().waitFor();
    await triggers.first().click();
    await page.getByRole('option', { name: shortTopic, exact: true }).click();
    await page.locator('#tracker-session-date').fill('2026-10-07');
    await page.getByRole('button', { name: 'Discard and change date', exact: true }).click();
    await page.getByText('No scheduled sessions for this day.', { exact: true }).waitFor();
    assert.equal(writes.length, 1, 'Changing dates must not save discarded edits');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await page.getByRole('tooltip').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Class-specific completed-topic highlighting, revision save, full-title hover/focus guide, ticker, dark theme, reduced motion and mobile bounds passed.');
} finally { await browser.close(); }
