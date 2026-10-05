import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
await mkdir('.tmp/demo-workspace',{recursive:true});
try {
 for(const width of [390,1366]) {
  const demo={...user,name:'TOMS Demo',role:'demo',isDemo:true,demoAccountId:user._id,appVersion:'2.2.2'};
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.addInitScript(u=>{localStorage.setItem('toms_token','demo-test-token');localStorage.setItem('toms_user',JSON.stringify(u))},demo);
  const writes=[], errors=[];
  await context.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname.replace(/^\/api/,'');
    if(request.method()!=='GET') writes.push(path);
    let data=path==='/auth/me'?demo:fixture(path,url.searchParams);
    if(path==='/auth/impersonation-targets') data={targets:[{_id:'preview',name:'Trainer Preview',trainerId:'trainer-0',employeeId:'123',role:'trainer'}]};
    if(path==='/trainers/trainer-0') data={...data,camuErpId:'adjfacultxxxxxxxx',camuPassword:'demoxxxx',_demoMaskedCredentials:true};
    if(path==='/ai/chat') data={text:'All permitted trainers are available to this admin-level demo.'};
    await route.fulfill({json:data});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/dashboard');
  await page.getByText('Demo workspace',{exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog',{name:/Set up TOMS/}).count(),0);
  // Every admin screen remains reachable at mobile and desktop sizes.
  for(const path of ['/trainers','/subjects','/venues','/classes-students','/leaves','/performance','/replacements','/topic-tracker','/tickets','/timetable']) {
    await page.goto(base+path); await page.locator('main').waitFor();
    await page.getByText('Demo workspace',{exact:true}).waitFor();
    assert.equal(new URL(page.url()).pathname,path);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),path+' overflow');
  }
  // Use the actual service client and adapter. Mutations must never reach route interception.
  const local=await page.evaluate(async()=>{
    const {default:api}=await import('/src/services/api.js');
    const original=(await api.get('/subjects')).data;
    const id=original.subjects[0]._id;
    await api.put(`/subjects/${id}`,{name:'Demo local subject'});
    await api.post('/venues',{name:'Demo venue',building:'Sample'});
    await api.put('/attendance/trainer-daily',{trainer:'trainer-0',date:'2026-10-05',mockPrepHours:3});
    await api.put('/topic-tracker/entries',{scheduleId:'schedule-test',date:'2026-09-30',topicModulesCovered:['Local arrays'],trackerStatus:'closed'});
    await api.put('/student-test-reports/bulk',{month:'2026-10',subject:'subject-test',entries:[{studentId:'u1',marksObtained:45,maxMarks:50,attendance:'P'}]});
    await api.patch('/notifications/read-all');
    const result=(await api.get('/subjects')).data;
    await api.post('/ai/chat',{message:'Who is available today?'});
    return {name:result.subjects[0].name,venues:(await api.get('/venues')).data.venues.map(v=>v.name)};
  });
  assert.equal(local.name,'Demo local subject'); assert.ok(local.venues.includes('Demo venue'));
  assert.deepEqual(writes,['/ai/chat']);
  // Refresh must keep the local changes, while the directory details mask each value.
  await page.goto(base+'/subjects');
  await page.getByText('Demo local subject',{exact:true}).waitFor();
  await page.goto(base+'/trainers/trainer-0');
  await page.getByText('adjfacultxxxxxxxx',{exact:true}).waitFor();
  await page.getByText('M Sai xxxxx',{exact:true}).waitFor();
  assert.equal(await page.getByText('M Sai Priya',{exact:true}).count(),0);
  await page.screenshot({path:`.tmp/demo-workspace/profile-${width}.png`});
  await page.getByRole('button',{name:'Edit Profile',exact:true}).click();
  const edit=page.getByRole('dialog',{name:'Edit Trainer',exact:true});
  await edit.locator('input[name="name"]').fill('Demo Edited Trainer');
  await edit.locator('button[type="submit"]').click();
  await page.getByText('Demo Editexxxxxxxxx',{exact:true}).waitFor();
  await page.reload(); await page.getByText('Demo Editexxxxxxxxx',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Reset demo changes',exact:true}).click();
  await page.getByText('Demo workspace',{exact:true}).waitFor();
  await page.goto(base+'/subjects');
  assert.equal(await page.getByText('Demo local subject',{exact:true}).count(),0);
  await page.getByText('Industrial Data Structures and Algorithms',{exact:true}).waitFor();
  assert.deepEqual(writes,['/ai/chat']);assert.deepEqual(errors,[]);
  // Switching to a real admin bypasses the local adapter and shows unmasked values.
  const real={...user,role:'admin',appVersion:'2.2.1'};
  await context.route('**/api/auth/me',route=>route.fulfill({json:real}));
  await context.route('**/api/trainers/trainer-0',route=>route.fulfill({json:{...fixture('/trainers/trainer-0'),camuErpId:'adjfaculty-cdc086'}}));
  await page.evaluate(u=>{localStorage.setItem('toms_user',JSON.stringify(u));localStorage.setItem(`toms_sallu_notice:${u._id}:2.2.1`,'seen')},real);
  await page.goto(base+'/trainers/trainer-0');
  await page.getByText('M Sai Priya',{exact:true}).waitFor(); await page.getByText('adjfaculty-cdc086',{exact:true}).waitFor();
  assert.equal(await page.getByText('Demo workspace',{exact:true}).count(),0);
  console.log(`Demo views, local edits, refresh/reset, AI and field masking passed at ${width}px`);
  await context.close();
 }
}finally{await browser.close()}
