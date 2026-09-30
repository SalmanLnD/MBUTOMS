import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture,user } from './responsive-fixtures.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base=process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5176';
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const output=process.env.RESPONSIVE_OUTPUT || '.tmp/responsive'; await mkdir(output,{recursive:true});
// Prefix tab: or filter: selects a tab/filter; all other steps are button names.
const cases=[
  ['/trainers',['+ Add Trainer']], ['/trainers',['Edit M Sai Priya']],
  ['/trainers',['Reset password for M Sai Priya']], ['/trainers',['Delete M Sai Priya']],
  ['/trainers/trainer-0',['Edit Profile']], ['/trainers/trainer-0',['Permanent Replacement']], ['/trainers/trainer-0',['Resignation / Exit']],
  ['/trainers',['tab:Comp Offs','Add Comp Off']], ['/trainers',['tab:Attendance','Holidays']],
  ['/trainers',['tab:Attendance','Link attendance sheet']],
  ['/subjects',['+ Add Subject']],
  ['/leaves',['Apply Leave']], ['/leaves',['Partial Cancel']], ['/leaves',['Cancel leave for M Sai Priya']],
  ['/tickets',['Raise Ticket']], ['/tickets',['View']], ['/tickets',['Update']],
  ['/replacements',['Bulk Replacement']], ['/replacements',['Bulk Replacement','radio:External trainer (create account)']],
  ['/replacements',['Add Replacement']], ['/replacements',['Change replacement for CSE A3']], ['/replacements',['Cancel replacement for CSE A3']],
  ['/timetable',['Special class']], ['/timetable',['Cancel classes']], ['/timetable',['Link to Sheets']],
  ['/venues',['tab:Room details','+ Add Venue']],
  ['/classes-students',['filter:Class filters','Add Class']],
  ['/classes-students',['tab:Students','filter:Student filters','Add Student']],
  ['/classes-students',['tab:Students','filter:Student filters','Bulk Upload']],
  ['/classes-students',['tab:Monthly Test Reports','Link test reports sheet']],
  ['/performance',['tab:Compliance','Add compliance']],
  ['/performance',['tab:PLP','Link Google Sheet']],
  ['/performance',['tab:Response logs','Link Google Sheet']],
  ['/topic-tracker',['Link Google Sheet']], ['/topic-tracker',['Open tracker']],
];
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH}: {})});
const results=[],failures=[];
for(const viewport of [{width:390,height:844},{width:1366,height:768},{width:568,height:320}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.addInitScript(u=>{localStorage.setItem('toms_token','responsive-test');localStorage.setItem('toms_user',JSON.stringify(u));},user);
  await context.route('**/api/**',async r=>{assert.equal(r.request().method(),'GET');const url=new URL(r.request().url());await r.fulfill({json:fixture(url.pathname.replace(/^\/api/,''),url.searchParams)});});
  const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(let index=0;index<cases.length;index++){
    const [path,steps]=cases[index];errors.length=0;
    try{
      await page.goto(base+path);await page.waitForSelector('main');await page.waitForTimeout(500);
      for(const step of steps){
        if(step.startsWith('tab:'))await page.locator('.nav-tabs button').filter({hasText:new RegExp(`^${step.slice(4)}$`,'i')}).click();
        else if(step.startsWith('filter:')){if(viewport.width<768)await page.getByRole('button',{name:step.slice(7),exact:true}).click();}
        else if(step.startsWith('radio:'))await page.getByRole('radio',{name:step.slice(6),exact:true}).check();
        else await page.getByRole('button',{name:step,exact:true}).first().click();
        await page.waitForTimeout(150);
      }
      const dialog=page.getByRole('dialog').last();await dialog.waitFor();await page.waitForTimeout(250);
      assert.deepEqual(errors,[]);
      const bounds=await dialog.boundingBox();assert.ok(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1,'Dialog overflows viewport');
      const controls=dialog.locator('input:not([type="hidden"]),select,textarea,button');
      for(let i=0;i<await controls.count();i++){
        const control=controls.nth(i),r=await control.boundingBox();if(!r||r.width<2||r.height<2)continue;
        await control.scrollIntoViewIfNeeded();const b=await control.boundingBox();assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,`Unreachable control ${i}: ${JSON.stringify(b)}`);
      }
      const title=await dialog.locator('.toms-modal-title').innerText();
      await page.screenshot({path:`${output}/page-dialog-${viewport.width}-${index}.png`});
      const headerClose=dialog.locator('.toms-modal-header .btn-close');
      if(await headerClose.count())await headerClose.click();
      else await dialog.getByRole('button',{name:'Close',exact:true}).click();
      await page.waitForTimeout(50);
      assert.equal(await page.getByRole('dialog').count(),0);
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
      results.push({path,steps,viewport,title});
    }catch(e){failures.push({path,steps,viewport,error:e.message,errors:[...errors]});console.log(`FAIL ${viewport.width} ${path} ${steps.at(-1)}: ${e.message}`);await page.screenshot({path:`${output}/FAILED-page-${viewport.width}-${index}.png`});}
  }
  console.log(`Page dialogs ${viewport.width}x${viewport.height}: ${results.filter(r=>r.viewport.width===viewport.width).length}/${cases.length} passed`);await context.close();
}
await browser.close();await writeFile(`${output}/page-dialog-report.json`,JSON.stringify({results,failures},null,2));
console.log(`${results.length} page dialog checks passed; ${failures.length} failed`);if(failures.length)process.exitCode=1;
