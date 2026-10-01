import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const baseURL = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5176';
assert.match(baseURL, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const output = process.env.RESPONSIVE_OUTPUT || '.tmp/ai-assistant';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const sizes = [[320,568], [390,844], [768,1024], [1366,768], [1920,1080], [3840,2160], [844,390]];
let checks = 0;
try {
  for (const role of ['admin', 'subject_coordinator', 'trainer', 'manager', 'campus_manager', 'evaluator']) {
    for (const [width, height] of (['admin', 'subject_coordinator'].includes(role) ? sizes : [[390,844], [1366,768]])) {
      const account = { ...user, role, trainer: 'trainer-0', appVersion: '2.2.1' };
      const checkAnimation = role === 'admin' && width === 390;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: checkAnimation ? 'no-preference' : 'reduce' });
      await context.addInitScript((u) => { localStorage.setItem('toms_token', 'synthetic-ai-test'); localStorage.setItem('toms_user', JSON.stringify(u)); }, account);
      let calls = 0; let quotaMode = 'ready';
      await context.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        if (path === '/ai/usage') return quotaMode === 'unavailable' ? route.fulfill({ status: 503, json: { message: 'Usage unavailable' } })
          : route.fulfill({ json: { configured: quotaMode !== 'setup', sharedExhausted: quotaMode === 'shared', questionsPerDay: 5, questionsPerMinute: 2,
            remaining: quotaMode === 'personal' ? 0 : Math.max(0, 5 - calls), used: quotaMode === 'personal' ? 5 : calls, resetAt: '2026-10-02T07:00:00Z' } });
        if (path === '/ai/chat') {
          assert.equal(route.request().method(), 'POST');
          assert.deepEqual(Object.keys(route.request().postDataJSON()), ['message']);
          assert.equal(route.request().headers().authorization, 'Bearer synthetic-ai-test');
          calls++;
          if (checkAnimation && calls === 4) { quotaMode = 'personal'; return route.fulfill({ status: 429, json: { code: 'AI_DAILY_LIMIT', message: 'You have used your 5 Sallu questions for today. Please try again after the daily reset.' } }); }
          if (checkAnimation && calls === 1) await new Promise((resolve) => setTimeout(resolve, 4500));
          if (calls === 2) return route.fulfill({ status: 503, json: { message: 'Temporary failure' } });
          return route.fulfill({ json: { message: calls === 1 ? 'Live data answer.\n' + 'A long operational answer to test scrolling and wrapping. '.repeat(55) : 'Retry succeeded.', toolCalls: [] } });
        }
        assert.equal(route.request().method(), 'GET');
        await route.fulfill({ json: path === '/auth/me' ? account : fixture(path, new URL(route.request().url()).searchParams) });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${baseURL}/dashboard`);
      await page.locator('main').waitFor();
      await page.getByRole('dialog', { name: 'Welcome to TOMS v2.2.1' }).waitFor();
      assert.ok(await page.getByText('5 questions per day', { exact: true }).isVisible());
      if (role === 'admin' && [390,1366].includes(width)) await page.screenshot({ path: `${output}/release-notice-${width}.png` });
      await page.getByRole('button', { name: 'Got it', exact: true }).click();
      const open = async () => {
        if (width < 768) await page.getByRole('button', { name: 'Open all pages' }).click();
        try { await page.getByRole('button', { name: 'Open Sallu' }).click(); }
        catch (error) { await page.screenshot({ path: `${output}/failure-${role}-${width}.png` }); console.error(`Assistant launcher failed: ${role}, ${width}x${height}`); throw error; }
        await page.getByRole('dialog', { name: 'Sallu' }).waitFor();
      };
      assert.equal(await page.getByRole('dialog', { name: 'Sallu' }).count(), 0);
      await open();
      assert.equal(await page.locator('.ai-assistant__suggestions button').count(), 3);
      await page.waitForTimeout(120);
      if (width === 390 || width === 1366) await page.screenshot({ path: `${output}/${role}-${width}-welcome.png` });
      if (width === 390) {
        await page.getByRole('button', { name: 'Switch to dark mode' }).click();
        assert.equal(await page.locator('.ai-assistant').evaluate((e) => getComputedStyle(e).backgroundColor), 'rgb(27, 41, 51)');
        await page.getByRole('button', { name: 'Switch to light mode' }).click();
        // Exercise real viewport resize events, including a short phone viewport.
        await page.setViewportSize({ width, height: 430 });
        await page.waitForFunction(() => {
          const rect = document.querySelector('.ai-assistant').getBoundingClientRect();
          return rect.y >= 0 && rect.bottom <= 430;
        });
        await page.setViewportSize({ width, height });
      }
      await page.locator('.ai-assistant__suggestions button').first().click();
      if (checkAnimation) {
        await page.locator('.ai-assistant__status').waitFor();
        const firstLine = await page.locator('.ai-assistant__status').textContent();
        assert.equal(await page.locator('.ai-assistant__header .sallu-avatar--thinking').count(), 1);
        await page.waitForFunction((first) => document.querySelector('.ai-assistant__status')?.textContent !== first, firstLine);
        await page.screenshot({ path: `${output}/sallu-thinking-mobile.png` });
      }
      await page.getByText('Live data answer.', { exact: false }).waitFor();
      if (checkAnimation) {
        assert.equal(await page.locator('.ai-assistant__header .sallu-avatar--speaking').count(), 1);
        await page.screenshot({ path: `${output}/sallu-speaking-mobile.png` });
        await page.waitForFunction(() => !document.querySelector('.sallu-avatar--speaking'));
        assert.equal(await page.locator('.ai-assistant__status').count(), 0);
        assert.equal(await page.locator('.ai-assistant__header .sallu-avatar--idle').count(), 1);
      }
      const bounds = await page.evaluate(() => {
        const p = document.querySelector('.ai-assistant').getBoundingClientRect();
        const composer = document.querySelector('.ai-assistant__composer').getBoundingClientRect();
        return { left: p.left, right: p.right, top: p.top, bottom: p.bottom, composerBottom: composer.bottom,
          scroll: document.documentElement.scrollWidth, bodyOverflow: document.body.style.overflow };
      });
      assert.ok(bounds.left >= 0 && bounds.right <= width + 1 && bounds.top >= 0 && bounds.bottom <= height + 1, JSON.stringify({ width, height, bounds }));
      assert.ok(bounds.composerBottom <= bounds.bottom);
      assert.ok(bounds.scroll <= width + 2);
      assert.notEqual(bounds.bodyOverflow, 'hidden', 'Modeless assistant must not lock page scrolling');
      await page.getByRole('button', { name: 'Close Sallu' }).click();
      await open();
      await page.getByText('Live data answer.', { exact: false }).waitFor();
      const input = page.getByRole('textbox', { name: 'Ask Sallu' });
      await input.fill('Show today’s timetable'); await input.press('Enter');
      await page.getByText('Could not get an answer. Please try again.').waitFor();
      assert.equal(calls, 2, 'AI POST must not retry automatically');
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByText('Retry succeeded.', { exact: true }).waitFor();
      if (checkAnimation) {
        await input.fill('One more question'); await input.press('Enter');
        await page.getByText('You have used your 5 Sallu questions for today. Please try again after the daily reset.', { exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelector('.ai-assistant__quota')?.textContent.includes('0 of 5'));
        assert.ok(await input.isDisabled());
        assert.equal(calls, 4);
        checks++;
        quotaMode = 'shared'; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.getByText('The shared free API budget is exhausted.', { exact: false }).waitFor();
        assert.ok(await input.isDisabled()); checks++;
        quotaMode = 'setup'; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.getByText('Sallu is paused until the free API quotas are configured.', { exact: true }).waitFor();
        assert.ok(await input.isDisabled()); checks++;
        quotaMode = 'unavailable'; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.getByText('Usage unavailable.', { exact: false }).waitFor();
        assert.ok(await input.isDisabled());
        quotaMode = 'ready'; await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('#ai-assistant-question').disabled);
        checks++;
      }
      if (width === 390 || width === 1366) await page.screenshot({ path: `${output}/${role}-${width}.png` });
      await input.focus(); await input.press('Escape');
      assert.equal(await page.getByRole('dialog', { name: 'Sallu' }).count(), 0);
      if (checkAnimation) {
        await page.reload(); await page.locator('main').waitFor();
        assert.equal(await page.getByRole('dialog', { name: 'Welcome to TOMS v2.2.1' }).count(), 0);
      }
      assert.deepEqual(errors, []);
      checks++; await context.close();
    }
  }
  for (const account of [{ ...user, impersonating: true }, { ...user, mustResetPassword: true }]) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript((u) => { localStorage.setItem('toms_token', 'synthetic-ai-test'); localStorage.setItem('toms_user', JSON.stringify(u)); }, account);
    await context.route('**/api/**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/auth/me' ? account : fixture(new URL(route.request().url()).pathname.replace(/^\/api/, '')) }));
    const page = await context.newPage(); await page.goto(`${baseURL}/dashboard`); await page.locator('main').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Open Sallu' }).count(), 0);
    checks++; await context.close();
  }
  console.log(`${checks} assistant UI scenarios passed (roles, viewports, close/reopen, requests, errors, retries and scrolling).`);
} finally { await browser.close(); }
