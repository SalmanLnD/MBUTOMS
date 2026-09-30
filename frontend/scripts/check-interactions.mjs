import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5176';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
let checks = 0;
for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1366,height:768},{width:568,height:320}]) {
  const context = await browser.newContext({viewport, reducedMotion:'reduce'});
  await context.addInitScript(u => { localStorage.setItem('toms_token','responsive-test'); localStorage.setItem('toms_user', JSON.stringify(u)); },user);
  await context.route('**/api/**', async r => {
    assert.equal(r.request().method(),'GET');
    const url=new URL(r.request().url()); await r.fulfill({json:fixture(url.pathname.replace(/^\/api/,''),url.searchParams)});
  });
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  async function layout() {
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2),`${page.url()} overflows at ${viewport.width}`);
    assert.deepEqual(errors,[]); checks++;
  }
  async function visit(path) { await page.goto(base+path); await page.waitForSelector('main'); await page.waitForTimeout(900); await layout(); }
  await visit('/trainers');
  if (viewport.width<768) await page.getByRole('button',{name:'Trainer filters',exact:true}).click();
  await page.getByRole('button',{name:'+ Add Trainer',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  const modal = await page.getByRole('dialog').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,left:r.left};});
  assert.ok(modal.top>=0 && modal.bottom<=viewport.height+1 && modal.left>=0 && modal.right<=viewport.width+1,'Modal fits viewport');
  // Find the submit control without submitting or changing any attendance data.
  const submit=page.locator('.toms-modal-content button[type="submit"]');
  await submit.scrollIntoViewIfNeeded(); assert.ok(await submit.isVisible());
  const bounds=await submit.boundingBox(); assert.ok(bounds.y>=0 && bounds.y+bounds.height<=viewport.height);
  await layout();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.body.style.overflow),''); checks++;
  if(viewport.width<768) {
    await page.getByRole('button',{name:'Open all pages'}).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('.mobile-pages-link').count(),11);
    await page.locator('.mobile-pages-link').last().scrollIntoViewIfNeeded();
    await layout(); await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(),0); checks++;
  }
  for (const [path, tabs] of [
    ['/venues',['Campus map','Range-wise mapping','Room details','Live']],
    ['/trainers',['Attendance','Logs','Comp Offs','Directory']],
    ['/performance',['Observations','Compliance','PLP','Feedback']],
    ['/classes-students',['Students','Classes']],
    ['/topic-tracker',['Class summary','Cancellations','Pending backlog']],
  ]) {
    await visit(path);
    for (const name of tabs) {
      const tab=page.locator('.nav-tabs button').filter({hasText:new RegExp(`^${name}$`,'i')});
      if(await tab.count()) { await tab.click(); await layout(); }
    }
  }
  await visit('/venues');
  await page.getByRole('button',{name:'Filter by status'}).click();
  const menu=page.locator('.toms-styled-select__menu'); await menu.waitFor();
  const r=await menu.boundingBox();assert.ok(r.x>=0 && r.x+r.width<=viewport.width+1 && r.y>=0 && r.y+r.height<=viewport.height+1,'Dropdown stays on screen');
  await page.keyboard.press('Escape'); checks++;
  await page.evaluate(()=>localStorage.setItem('toms_theme','dark')); await page.reload(); await layout();
  console.log(`Interaction checks passed at ${viewport.width} × ${viewport.height}`);
  await context.close();
}
// Public timetable and feedback form must remain usable without authentication.
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.route('**/api/**',async r=>{ const url=new URL(r.request().url());await r.fulfill({json:fixture(url.pathname.replace(/^\/api/,''),url.searchParams)}); });
const page=await context.newPage();
for (const path of ['/timetable','/f/test-form','/login']) {
  await page.goto(base+path); await page.waitForTimeout(1200);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2)); checks++;
}
await context.close();await browser.close();
console.log(`${checks} responsive interaction checks passed`);
