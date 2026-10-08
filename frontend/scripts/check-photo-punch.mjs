import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { fixture, user } from './responsive-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
try {
  await mkdir('.tmp/photo-punch', { recursive: true });
  for (const width of [390, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, permissions: ['camera', 'geolocation'],
      geolocation: { latitude: 13.621069, longitude: 79.289828, accuracy: 10 } });
    await context.addInitScript(user => { localStorage.setItem('toms_token', 'test'); localStorage.setItem('toms_user', JSON.stringify(user)); }, user);
    let submissions = 0, blocked = false;
    await context.route('**/api/**', route => {
      const url = new URL(route.request().url()); const path = url.pathname.replace(/^\/api/, '');
      if (path === '/photo-punch/config') return route.fulfill({json: {mode: 'live', campusVerified: false, campus: {latitude: 13.621069, longitude: 79.289828}}});
      if (path === '/photo-punch/scheduled-oif') return route.fulfill({json: {oifNumber:'CT27004',classHandlingHours:3,mockPrepHours:0}});
      if (path === '/photo-punch/capture-session') return route.fulfill(blocked ? {status: 403, json: {message: 'VPN or proxy detected. Turn it off before taking a photo.'}} : {json: {token: 'test-token', mode: 'live', capturedAt: new Date().toISOString(), distance: 0, network: 'unknown', location: route.request().postDataJSON().location}});
      if (path === '/photo-punch/submit') {
        submissions++; assert.ok(route.request().postDataBuffer().includes(Buffer.from('image/jpeg')));
        return route.fulfill({json: {message: 'Punch-in recorded.', folder: 'toms punch ins/2026-10-07'}});
      }
      return route.fulfill({json: path === '/ai/usage' ? {configured: false} : fixture(path, url.searchParams)});
    });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5173/punch-in');
    await page.getByRole('heading', {name: 'Campus punch-in'}).waitFor();
    assert.equal(await page.getByLabel('OIF type').inputValue(), 'scheduled');
    await page.getByText(/CT27004.*3 class hours/).waitFor();
    await page.getByLabel('OIF type').selectOption('other');
    await page.getByLabel('OIF number', {exact:true}).fill('XX123');
    await page.getByLabel('Class hours', {exact:true}).fill('2');
    await page.getByLabel('Mock or IT hours').fill('3');
    await page.getByLabel('OIF type').selectOption('it');
    await page.getByText(/OIF: IT/).waitFor();
    await page.getByLabel('OIF type').selectOption('capsule');
    await page.getByText(/OIF: CA26421/).waitFor();
    await page.getByLabel('OIF type').selectOption('scheduled');
    await page.getByRole('button', {name: 'Enable camera & location'}).click();
    await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
    await page.getByRole('button', {name: 'Take photo', exact: true}).click();
    await page.getByRole('img', {name: 'Captured punch-in photo with location and IST timestamp'}).waitFor();
    await page.screenshot({path: `.tmp/photo-punch/${width}-review.png`});
    await page.getByRole('button', {name: 'Punch in'}).click();
    await page.getByText('You are checked in', {exact: true}).waitFor(); assert.equal(submissions, 1);
    blocked = true; await page.getByRole('button', {name: 'Start again'}).click();
    await page.getByRole('alert').filter({hasText: 'VPN or proxy detected'}).waitFor();
    assert.equal(await page.locator('video').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(errors, []); await context.close();
  }
  console.log('Desktop/mobile camera capture, JPEG stamping, punch-in submission and VPN-block UI passed. Services were mocked; no real Drive upload or attendance write.');
} finally { await browser.close(); }
