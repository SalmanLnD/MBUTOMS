import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';

// Start Vite with VITE_API_URL=/api. Install Playwright or set PLAYWRIGHT_MODULE_PATH.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const baseURL = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5176';
assert.match(baseURL, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, 'Only a local development server is allowed');
const output = process.env.RESPONSIVE_OUTPUT || '.tmp/responsive';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const sizes = [[320,568], [390,844], [768,1024], [1366,768], [1920,1080], [3840,2160], [844,390]];
const routes = ['/dashboard','/trainers','/trainers/trainer-0','/trainers/trainer-0/schedule','/subjects','/timetable','/venues','/classes-students','/leaves','/tickets','/topic-tracker','/replacements','/performance','/trainers?tab=attendance'];
const failures = []; const results = [];
for (const [width,height] of sizes) {
  const context = await browser.newContext({ viewport: { width,height }, reducedMotion: 'reduce' });
  await context.addInitScript(u => { localStorage.setItem('toms_token','responsive-test'); localStorage.setItem('toms_user',JSON.stringify(u)); }, user);
  await context.route('**/api/**', async route => {
    assert.equal(route.request().method(), 'GET', 'Responsive tests must not mutate data');
    await route.fulfill({ json: fixture(new URL(route.request().url()).pathname.replace(/^\/api/,''), new URL(route.request().url()).searchParams) });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  for (const path of routes) {
    errors.length = 0;
    await page.goto(baseURL + path); await page.waitForSelector('main'); await page.waitForTimeout(1200);
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, content: document.querySelector('main')?.innerText?.length || 0, overflow: [...document.querySelectorAll('main *')].filter(e => { const r=e.getBoundingClientRect(); return r.width>0 && r.right>innerWidth+2 && !e.closest('.table-responsive,.timetable-grid-wrap,.trainer-attendance-grid,.nav-tabs'); }).slice(0,8).map(e=>`${e.tagName}.${e.className}`) }));
    if (layout.scrollWidth > width + 2 || errors.length || layout.content < 10) failures.push({ width,height,path,layout,errors: [...errors] });
    results.push({ width,height,path,...layout });
    if ((width === 390 || width === 1366) && ['/dashboard','/trainers','/timetable','/venues'].includes(path)) await page.screenshot({ path: `${output}/${width}-${path.slice(1)}.png` });
  }
  await context.close();
}
await browser.close();
await writeFile(`${output}/report.json`, JSON.stringify({ results,failures }, null,2));
console.log(`${results.length} responsive route checks; ${failures.length} failures`);
if (failures.length) { console.log(JSON.stringify(failures,null,2)); process.exitCode=1; }
