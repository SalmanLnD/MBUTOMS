import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fixture,user} from './responsive-fixtures.mjs';
const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.CONTRAST_OUTPUT || '.tmp/contrast'; await mkdir(output,{recursive:true});
const modalSource = await readFile(new URL('./check-modals.mjs',import.meta.url),'utf8');
const modalCases = new Function('fixture', `${modalSource.slice(modalSource.indexOf('const trainer ='),modalSource.indexOf('const browser ='))};return cases;`)(fixture);
const dialogSource = await readFile(new URL('./check-page-dialogs.mjs',import.meta.url),'utf8');
const dialogCases = new Function(`${dialogSource.slice(dialogSource.indexOf('const cases='),dialogSource.indexOf('const browser='))};return cases;`)();

// Text contrast against composited CSS backgrounds. Disabled controls are exempt.
function contrastAudit() {
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(e => !e.hidden && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility === 'visible');
  const activeDialog = dialogs.at(-1);
  const rgba = value => { const m=value.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').map(Number).concat([1]).slice(0,4) : null; };
  const mix=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
  const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const issues=[]; const seen=new Set();
  for(const e of document.querySelectorAll('body *')) {
    if (activeDialog && !activeDialog.contains(e) && !e.closest('[role="listbox"]')) continue;
    if(['SCRIPT','STYLE','OPTION','SVG','PATH'].includes(e.tagName)||e.closest('svg,[aria-hidden="true"]')||e.matches(':disabled')||e.closest('[inert]'))continue;
    const s=getComputedStyle(e),r=e.getBoundingClientRect();
    if(r.width<1||r.height<1||s.visibility!=='visible'||s.display==='none'||r.bottom<0||r.top>innerHeight)continue;
    const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ') || (e.matches('input:not([type=checkbox]):not([type=radio]),textarea')?e.value||e.placeholder:'');
    if(!text)continue;
    const fg=rgba(e.matches('input,textarea')&&!e.value&&e.placeholder?getComputedStyle(e,'::placeholder').color:s.color); if(!fg)continue;
    const chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);
    let bg=[255,255,255],opacity=1;
    for(const p of chain){const ps=getComputedStyle(p),c=rgba(ps.backgroundColor);if(c)bg=mix(c,bg);opacity*=Number(ps.opacity);}
    if(opacity<.5)continue;
    const color=mix([...fg.slice(0,3),fg[3]*opacity],bg);
    const l1=lum(color),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700),limit=large?3:4.5;
    if(ratio+0.05<limit){const signature=[s.color,bg.join(','),e.className,text.slice(0,35)].join('|');if(seen.has(signature))continue;seen.add(signature);issues.push({text:text.slice(0,90),selector:e.tagName+'.'+String(e.className).replaceAll(' ','.'),color:s.color,bg:bg.map(Math.round),ratio:+ratio.toFixed(2),limit});}
  }
  return issues;
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const results=[], failures=[];
for(const theme of (process.env.CONTRAST_THEMES||'dark,light').split(',')) {
 const context=await browser.newContext({viewport:{width:1366,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(({user,theme})=>{localStorage.setItem('toms_token','audit');localStorage.setItem('toms_user',JSON.stringify(user));localStorage.setItem('toms_theme',theme);}, {user,theme});
 await context.route('**/api/**',async route=>{const u=new URL(route.request().url());const p=u.pathname.replace(/^\/api/,'');await route.fulfill({json:p==='/photo-punch/config'?{mode:'live'}:p==='/photo-punch/scheduled-oif'?{oifNumber:'CT27004',classHandlingHours:3}:fixture(p,u.searchParams)});});
 const page=await context.newPage();page.setDefaultTimeout(5000);
 const inspect=async name=>{await page.waitForTimeout(150);const issues=await page.evaluate(contrastAudit);results.push({theme,name,issues});await writeFile(`${output}/report.json`,JSON.stringify({results,failures},null,2));await page.screenshot({path:`${output}/${theme}-${name.replaceAll(/[^a-z0-9-]/gi,'_')}.png`});};
 await page.goto(base+'/scripts/ui-audit/index.html');await page.waitForFunction(()=>window.modalAudit);
 for(let i=0;i<(process.env.CONTRAST_SCREENS_ONLY?0:modalCases.length);i++){const [name,props]=modalCases[i];try{await page.evaluate(({name,props})=>window.modalAudit.mount(name,props),{name,props});await page.getByRole('dialog').waitFor();await inspect(`modal-${i}-${name}`);
 const menus=page.locator('[role="dialog"] button[aria-haspopup="listbox"]');
 for(let j=0;j<await menus.count();j++){const menu=menus.nth(j);if(!await menu.isEnabled())continue;await menu.scrollIntoViewIfNeeded();await menu.click();await inspect(`menu-${i}-${j}-${name}`);await page.keyboard.press('Escape');}
 await page.locator('.toms-modal-body').evaluateAll(nodes=>nodes.forEach(e=>e.scrollTop=e.scrollHeight));await inspect(`modal-bottom-${i}-${name}`);
 await page.evaluate(()=>window.modalAudit.close());}catch(e){failures.push({theme,name,error:e.message});await page.reload();await page.waitForFunction(()=>window.modalAudit);}}
 const routes=['/dashboard','/trainers','/trainers/trainer-0','/trainers/trainer-0/schedule','/subjects','/timetable','/venues','/classes-students','/leaves','/tickets','/topic-tracker','/replacements','/performance','/punch-in'];
 for(const path of routes){await page.goto(base+path);await page.waitForSelector('main');await page.waitForTimeout(350);await inspect('screen-'+path);}
 for(let i=0;i<(process.env.CONTRAST_SCREENS_ONLY?0:dialogCases.length);i++){const [path,steps]=dialogCases[i];try{await page.goto(base+path);await page.waitForSelector('main');await page.waitForTimeout(300);for(const step of steps){if(step.startsWith('tab:'))await page.locator('.nav-tabs button').filter({hasText:new RegExp(`^${step.slice(4)}$`,'i')}).click();else if(step.startsWith('filter:')){const filter=page.getByRole('button',{name:step.slice(7),exact:true});if(await filter.count()&&await filter.getAttribute('aria-expanded')!=='true')await filter.click();}else if(step.startsWith('radio:'))await page.getByRole('radio',{name:step.slice(6),exact:true}).check();else await page.getByRole('button',{name:step==='Special class'?'Special classes':step,exact:true}).first().click();}await page.getByRole('dialog').last().waitFor();await inspect(`dialog-${i}-${steps.at(-1)}`);}catch(e){failures.push({theme,path,steps,error:e.message});}}
 console.log(theme+': '+results.filter(r=>r.theme===theme).length+' screens/modal states checked');await context.close();
}
await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({results,failures},null,2));
console.log(JSON.stringify({checks:results.length,failures,contrastIssues:results.reduce((n,r)=>n+r.issues.length,0)}));
if (failures.length || results.some(r => r.issues.length)) process.exitCode = 1;

