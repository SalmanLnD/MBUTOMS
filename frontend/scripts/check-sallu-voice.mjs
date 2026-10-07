import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  for (const width of [390, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(user => {
      localStorage.setItem('toms_token', 'test'); localStorage.setItem('toms_user', JSON.stringify(user));
      localStorage.setItem(`toms_sallu_notice:${user._id}:2.2.1`, 'seen');
      window.SpeechRecognition = class {
        constructor() { window.voiceSession = this; }
        start() { this.started = true; }
        stop() { this.onend?.(); }
        abort() { this.aborted = true; }
      };
    }, user);
    let calls = 0;
    await context.route('**/api/**', route => {
      const url = new URL(route.request().url()); const path = url.pathname.replace(/^\/api/, '');
      if (path === '/ai/chat') calls++;
      return route.fulfill({ json: path === '/ai/usage' ? { configured: true, unlimitedPersonal: true, remaining: null, questionsPerDay: null, questionsPerMinute: null, sharedRemaining: 200, providerCallsPerDay: 400 } : path === '/ai/chat' ? { message: 'Test reply' } : fixture(path, url.searchParams) });
    });
    const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5173');
    if (width < 768) await page.getByRole('button', { name: 'Show Sallu pet' }).click();
    await page.getByRole('button', { name: 'Chat with Sallu', exact: true }).click();
    assert.equal(await page.getByText('Admin: no personal question limit. Shared budget applies.', { exact: false }).count(), 0);
    const draft = page.getByRole('textbox', { name: 'Ask Sallu' });
    await draft.fill('Please check');
    await page.getByRole('button', { name: 'Start voice input' }).click();
    assert.ok(await page.getByRole('button', { name: 'Send question' }).isDisabled());
    await page.evaluate(() => {
      window.voiceSession.onresult({ results: [[{ transcript: 'my timetable' }]] });
      window.voiceSession.onresult({ results: [[{ transcript: 'my timetable tomorrow' }]] });
    });
    await page.waitForFunction(() => document.querySelector('#ai-assistant-question').value === 'Please check my timetable tomorrow');
    assert.equal(await draft.inputValue(), 'Please check my timetable tomorrow');
    assert.equal(calls, 0);
    await page.getByRole('button', { name: 'Stop voice input' }).click();
    await draft.fill('Edited timetable question');
    await page.getByRole('button', { name: 'Send question' }).click();
    await page.getByText('Test reply', { exact: true }).waitFor(); assert.equal(calls, 1);
    await page.getByRole('button', { name: 'Start voice input' }).click();
    await page.evaluate(() => { window.voiceSession.onerror({ error: 'not-allowed' }); window.voiceSession.onend(); });
    await page.getByText(/Microphone access was denied/).waitFor();
    await page.getByRole('button', { name: 'Start voice input' }).click();
    await page.getByRole('button', { name: 'Close Sallu', exact: true }).click();
    assert.equal(await page.evaluate(() => window.voiceSession.aborted), true);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await context.close();
  }
  console.log('Desktop/mobile voice drafts, interim replacement, manual editing/sending, permission errors and close cleanup passed.');
} finally { await browser.close(); }
