import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5176';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const output = process.env.RESPONSIVE_OUTPUT || '.tmp/responsive';
await mkdir(output,{recursive:true});
const trainer = fixture('/trainers').trainers[0];
const subject = fixture('/subjects').subjects[0];
const venue = fixture('/venues').venues[0];
const cases = [
  ['TrainerFormModal',{}], ['TrainerFormModal',{trainer}],
  ['SubjectFormModal',{}], ['SubjectFormModal',{subject}],
  ['VenueFormModal',{}], ['VenueFormModal',{venue}], ['VenueDetailModal',{venue}],
  ['ClassFormModal',{}], ['ClassFormModal',{classItem:{_id:'class-test',department:'CSE',section:'A3',semester:'III',allottedStudents:60}}],
  ['StudentFormModal',{}], ['StudentFormModal',{student:{_id:'student-test',name:'Student with a long name',rollNumber:'TEST100',department:'CSE',section:'A3',semester:'III',status:'active'}}],
  ['StudentBulkUploadModal',{}], ['ComplianceFormModal',{trainers:[trainer]}],
  ['AddSlotReplacementModal',{}], ['OfficialHolidayModal',{}],
  ['SpecialClassModal',{trainers:[trainer],initialDate:'2026-09-30'}], ['SpecialClassModal',{trainers:[trainer],initialTab:'list',initialDate:'2026-09-30'}],
  ['ClassCancellationModal',{initialDate:'2026-09-30'}],
  ['TimetableSlotModal',{trainerCode:trainer.employeeId,day:'Monday',slot:'S1',subject,subjects:[subject]}],
  ['TimetableSlotModal',{trainerCode:trainer.employeeId,day:'Monday',slot:'S1',subject,subjects:[subject],schedule:fixture('/schedules/timetable-board').schedulesByTrainer[trainer.employeeId][0]}],
  ['ScheduleFormModal',{}],
  ['TrainerRoleTransferModal',{trainer,mode:'resign'}], ['TrainerRoleTransferModal',{trainer,mode:'relocate'}], ['TrainerRoleTransferModal',{trainer,mode:'replace'}],
  ['SubjectTopicsModal',{subject:{...subject,topics:['Introduction','Arrays','Linked lists','Trees','Revision']}}],
  ['SubjectResourceLinkModal',{title:'Add syllabus link'}],
  ['TopicTrackerSpreadsheet',{date:'2026-09-30',subjectId:subject._id,trainerId:trainer._id,title:'Topic tracker — long training session title'}],
  ...['Timetable','TrainerAttendance','Feedback','TopicTracker','Plp','StudentTestReport'].map(prefix=>[`${prefix}SheetSetupModal`,{}]),
  ['ResetPasswordModal',{}], ['LoginModal',{}], ['SessionExpiredModal',{}],
  ['ConfirmModal',{title:'Delete item',message:'This is a synthetic confirmation screen. No changes will be submitted.',confirmLabel:'Delete'}],
];
const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH}: {})});
const results=[]; const failures=[];
for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1366,height:768},{width:568,height:320}]) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.addInitScript(u=>{localStorage.setItem('toms_token','responsive-test');localStorage.setItem('toms_user',JSON.stringify(u));},user);
  await context.route('**/api/**',async r=>{
    const url=new URL(r.request().url());
    if(r.request().method()!=='GET') throw new Error(`Unexpected write: ${r.request().method()} ${url.pathname}`);
    await r.fulfill({json:fixture(url.pathname.replace(/^\/api/,''),url.searchParams)});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/scripts/ui-audit/index.html`);await page.waitForFunction(()=>window.modalAudit);
  for (let index=0;index<cases.length;index++) {
    const [name,props]=cases[index];errors.length=0;
    try {
      await page.evaluate(async ({name,props})=>window.modalAudit.mount(name,props),{name,props});
      await page.getByRole('dialog').waitFor({timeout:5000});await page.waitForTimeout(250);
      assert.deepEqual(errors,[],`${name} runtime errors`);
      const layout=await page.getByRole('dialog').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,left:r.left,right:r.right,bottom:r.bottom};});
      assert.ok(layout.top>=-1&&layout.left>=-1&&layout.right<=viewport.width+1&&layout.bottom<=viewport.height+1,`${name} dialog exceeds viewport: ${JSON.stringify(layout)}`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${name} document overflows`);
      const controls=page.locator('.toms-modal-content input:not([type="hidden"]),.toms-modal-content textarea,.toms-modal-content button,.toms-modal-content a[href]');
      let reachable=0;
      for(let i=0;i<await controls.count();i++) {
        const control=controls.nth(i);const initial=await control.boundingBox();if(!initial||initial.width<2||initial.height<2)continue;
        await control.scrollIntoViewIfNeeded();const r=await control.boundingBox();
        assert.ok(r.x>=-1&&r.x+r.width<=viewport.width+1&&r.y>=-1&&r.y+r.height<=viewport.height+1,`${name} unreachable control ${i}: ${JSON.stringify(r)}`);reachable++;
      }
      await page.screenshot({path:`${output}/modal-${viewport.width}-${index}-${name}.png`});
      await page.evaluate(()=>window.modalAudit.close());await page.waitForTimeout(25);
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'',`${name} leaves scrolling locked`);
      results.push({name,index,viewport,reachable});
    } catch(e) {
      console.log(`FAIL ${viewport.width} ${name}: ${e.message}`);
      failures.push({name,index,viewport,error:e.message,errors:[...errors]});
      await page.screenshot({path:`${output}/FAILED-${viewport.width}-${index}-${name}.png`});
      await page.reload();await page.waitForFunction(()=>window.modalAudit);
    }
  }
  console.log(`Modal audit ${viewport.width}x${viewport.height}: ${results.filter(r=>r.viewport.width===viewport.width).length}/${cases.length} passed`);
  await context.close();
}
await browser.close();
await writeFile(`${output}/modal-report.json`,JSON.stringify({results,failures},null,2));
console.log(`${results.length} modal checks passed; ${failures.length} failed`);
if(failures.length){console.log(JSON.stringify(failures,null,2));process.exitCode=1;}
