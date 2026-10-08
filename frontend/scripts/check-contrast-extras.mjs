import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fixture,user} from './responsive-fixtures.mjs';
import {FEEDBACK_ANNOUNCEMENT} from '../../backend/utils/feedbackAnnouncement.js';
const source=await readFile(new URL('./check-contrast.mjs',import.meta.url),'utf8');
const audit=new Function('return '+source.slice(source.indexOf('function contrastAudit()'),source.indexOf('const browser=',source.indexOf('function contrastAudit()'))).trim())();
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const results=[],failures=[];const output='.tmp/contrast';await mkdir(output,{recursive:true});
for(const theme of (process.env.CONTRAST_THEMES||'dark,light').split(','))for(const width of (process.env.CONTRAST_WIDTHS||'390,1366').split(',').map(Number)){
 const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
 await context.addInitScript(({user,theme})=>{localStorage.setItem('toms_token','audit');localStorage.setItem('toms_user',JSON.stringify(user));localStorage.setItem('toms_theme',theme);},{user,theme});
 await context.route('**/api/**',async route=>{const u=new URL(route.request().url()),p=u.pathname.replace(/^\/api/,'');await route.fulfill({json:p==='/announcements/current'?{announcement:FEEDBACK_ANNOUNCEMENT,dismissed:true,preview:true}:p==='/ai/usage'?{configured:true,remaining:10,questionsPerDay:20,questionsPerMinute:3,resetAt:'2026-10-09T00:00:00Z'}:fixture(p,u.searchParams)});});
 const page=await context.newPage();page.setDefaultTimeout(5000);const base='http://127.0.0.1:5173';
 async function inspect(name){await page.waitForTimeout(250);results.push({theme,width,name,issues:await page.evaluate(audit)});await page.screenshot({path:`${output}/extra-${theme}-${width}-${name.replaceAll(/[^a-z0-9]/gi,'_')}.png`});}
 async function visit(path){await page.goto(base+path);await page.waitForTimeout(450);}
 for(const [path,tabs] of [
 ['/venues',['Campus map','Range-wise mapping','Room details','Live']],
 ['/trainers',['Attendance','Logs','Comp Offs','Directory']],
 ['/performance',['Observations','Compliance','PLP','Feedback','Summary','Response logs','Feedback form']],
 ['/classes-students',['Students','Monthly Test Reports','Classes']],
 ['/topic-tracker',['Class summary','Cancellations','Pending backlog']],
 ]){await visit(path);for(const name of tabs){const tab=page.locator('.nav-tabs button').filter({hasText:new RegExp(`^${name}$`,'i')});if(await tab.count()){await tab.click();await inspect(path+'-'+name);}}}
 for(const path of ['/login','/f/test-form']){await visit(path);await inspect(path);}
 for(const [name,action] of [
 ['device-settings',async()=>page.getByRole('button',{name:'Install TOMS and notifications',exact:true}).click()],
 ['notifications',async()=>page.getByRole('button',{name:/^Notifications/}).first().click()],
 ...(width===1366?[['sallu-chat',async()=>page.getByRole('button',{name:/Chat with Sallu|Talk to Sallu|Open Sallu/}).first().click()]]:[]),
 ]){try{await visit('/dashboard');await action();await page.getByRole('dialog').last().waitFor();await inspect(name);}catch(e){failures.push({theme,width,name,error:e.message});}}
 if(width===390){await visit('/dashboard');await page.getByRole('button',{name:'Open all pages'}).click();await page.getByRole('dialog').waitFor();await inspect('mobile-all-pages');}
 await visit(`/dashboard?announcement=${FEEDBACK_ANNOUNCEMENT.id}`);await page.getByRole('dialog').last().waitFor();await inspect('feedback-announcement');
 await context.close();
}
await browser.close();await writeFile(output+'/extra-report.json',JSON.stringify({results,failures},null,2));console.log(JSON.stringify({checks:results.length,failures,issues:results.filter(r=>r.issues.length)},null,2));
if (failures.length || results.some(r => r.issues.length)) process.exitCode = 1;



