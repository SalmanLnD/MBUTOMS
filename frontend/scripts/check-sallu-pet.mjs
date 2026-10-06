import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {setTimeout as settleAnimation} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {fixture,user} from './responsive-fixtures.mjs';
import {cursorPose,nextPunchReaction,reactionDialogues} from '../src/utils/salluPetBehavior.js';
const bag=[];let previous=-1;const expressions=[];for(let i=0;i<30;i++){const next=nextPunchReaction(bag,previous);assert.notEqual(next,previous);expressions.push(next);previous=next;}assert.equal(new Set(expressions.slice(0,15)).size,15);assert.equal(new Set(expressions.slice(15)).size,15);
const directions=[[-150,-400,0],[-300,-300,1],[0,-400,2],[150,-400,3],[-500,0,4],[-450,-200,5],[300,-250,6],[500,0,7],[-150,400,8],[-300,300,9],[0,400,10],[200,400,11],[-200,0,12],[200,0,13],[-800,-300,14],[800,-300,15]];for(const [x,y,index]of directions)assert.equal(cursorPose(x,y),'gaze-'+index);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base=process.env.RESPONSIVE_BASE_URL||'http://127.0.0.1:5173';assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});await mkdir('.tmp/sallu-pet',{recursive:true});
try{for(const width of [390,1366]){
const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference',hasTouch:width<768});
await context.addInitScript(u=>{localStorage.setItem('toms_token','test');localStorage.setItem('toms_user',JSON.stringify(u));localStorage.setItem(`toms_sallu_notice:${u._id}:2.2.1`,'seen');Math.random=()=>.25;localStorage.setItem('toms_sallu_pet_hidden','true');window.petSoundCount=0;const start=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(...args){window.petSoundCount++;return start.apply(this,args);};},user);
let calls=0;await context.route('**/api/**',r=>{const u=new URL(r.request().url()),p=u.pathname.replace(/^\/api/,'');if(p==='/ai/chat')calls++;return r.fulfill({json:p==='/ai/usage'?{configured:true,remaining:5}:fixture(p,u.searchParams)});});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(base+'/dashboard');if(width<768){await page.getByRole('button',{name:'Show Sallu pet'}).click();}await page.locator('.sallu-pet').waitFor();await page.locator('main').waitFor();await page.locator('.sallu-pet__sprite').first().evaluate(async()=>{const i=new Image();i.src='/images/sallu/character-atlas.png';await i.decode();});await page.screenshot({path:`.tmp/sallu-pet/${width}-idle.png`});
await page.getByRole('button',{name:'Poke Sallu',exact:true}).click();assert.ok(reactionDialogues[await page.locator('.sallu-pet').getAttribute('data-reaction')].includes(await page.locator('.sallu-pet__bubble').innerText()));assert.equal(calls,0);await page.locator('.sallu-pet[data-sound="playing"]').waitFor();assert.equal(await page.evaluate(()=>window.petSoundCount),1);await page.screenshot({path:`.tmp/sallu-pet/${width}-ouch.png`});await page.clock.fastForward(2300);
await page.getByRole('button',{name:'Chat with Sallu'}).click();await page.getByRole('dialog',{name:'Sallu',exact:true}).waitFor();assert.equal(calls,0);await page.keyboard.press('Escape');await page.locator('.sallu-pet').waitFor({state:'visible'});
await page.getByRole('button',{name:'Sallu pet options'}).click();await page.getByRole('button',{name:'Mute reaction sound'}).click();await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Poke Sallu',exact:true}).click();assert.equal(await page.evaluate(()=>window.petSoundCount),1);await page.clock.fastForward(2300);await page.getByRole('button',{name:'Sallu pet options'}).click();const beforeRoam=await page.locator('.sallu-pet').boundingBox();await page.getByRole('button',{name:'Start roaming'}).click();await page.mouse.move(10,10);await page.locator('.sallu-pet.is-walking').waitFor();assert.equal(await page.locator('.sallu-pet.is-nodding').count(),0);assert.equal(await page.locator('.sallu-pet').getAttribute('data-pose'),'front');await page.clock.runFor(700);await settleAnimation(700);assert.equal(await page.locator('.sallu-pet.is-walking').count(),1);const duringRoam=await page.locator('.sallu-pet').boundingBox();assert.ok(Math.abs(duringRoam.x-beforeRoam.x)>3||Math.abs(duringRoam.y-beforeRoam.y)>3,'Start roaming must move the pet, not only change its pose');await page.getByRole('button',{name:'Sallu pet options'}).click({force:true});await page.getByRole('button',{name:'Pause roaming'}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('toms_sallu_pet_paused')),'true');await page.getByRole('button',{name:'Hide Sallu',exact:true}).click();await page.getByRole('button',{name:width<768?'Show Sallu pet':'Toggle Sallu pet'}).click();await page.locator('.sallu-pet').waitFor();
if(width>767){const toggle=page.getByRole('button',{name:'Toggle Sallu pet'});await toggle.click();assert.equal(await page.locator('.sallu-pet').count(),0);assert.equal(await page.getByRole('dialog',{name:'Sallu',exact:true}).count(),0);await toggle.click();await page.getByRole('link',{name:'Dashboard',exact:true}).click();assert.equal(await page.locator('.sallu-pet.is-nodding').count(),1);await page.screenshot({path:'.tmp/sallu-pet/nod.png'});await page.clock.fastForward(1000);assert.equal(await page.locator('.sallu-pet.is-nodding').count(),0);await page.mouse.move(10,300);await page.clock.fastForward(300);await page.mouse.move(20,300);const gazeBox=await page.locator('.sallu-pet').boundingBox();assert.equal(await page.locator('.sallu-pet').getAttribute('data-pose'),cursorPose(20-gazeBox.x-gazeBox.width/2,300-gazeBox.y-gazeBox.height*.28));await page.getByRole('button',{name:'Sallu pet options'}).click();await page.getByRole('button',{name:'Start roaming'}).click();await page.mouse.move(10,10);await page.locator('.sallu-pet.is-walking').waitFor();assert.equal(await page.locator('.sallu-pet.is-walking').count(),1);await page.screenshot({path:'.tmp/sallu-pet/walking.png'});await page.clock.fastForward(4500);assert.equal(await page.locator('.sallu-pet.is-walking').count(),0);}
await page.getByRole('button',{name:'Sallu pet options'}).click();await page.getByRole('button',{name:'Talk to Sallu',exact:true}).click();await page.getByRole('dialog',{name:'Sallu',exact:true}).waitFor();await page.keyboard.press('Escape');await page.locator('.sallu-pet').waitFor({state:'visible'});
if(width>767){await page.getByRole('button',{name:'Sallu pet options'}).click();const panel=page.locator('.sallu-pet__menu');await panel.hover();await page.mouse.move(300,200);await page.clock.fastForward(600);assert.equal(await panel.count(),1);await panel.hover();await page.clock.fastForward(600);assert.equal(await panel.count(),1);await page.mouse.move(300,200);await page.clock.fastForward(1100);assert.equal(await panel.count(),0);}
const seen=new Set();let lastExpression;
for(let i=0;i<30;i++){await page.getByRole('button',{name:'Poke Sallu',exact:true}).click();const expression=await page.locator('.sallu-pet').getAttribute('data-reaction');assert.notEqual(expression,lastExpression);assert.ok(reactionDialogues[expression].includes(await page.locator('.sallu-pet__bubble').innerText()));seen.add(expression);lastExpression=expression;if(i===2)await page.screenshot({path:'.tmp/sallu-pet/'+width+'-reaction.png'});await page.clock.fastForward(2300);}assert.equal(seen.size,15);
await page.clock.fastForward(5000);
await page.getByRole('button',{name:'Sallu pet options'}).click();
await page.getByRole('button',{name:'Enable reaction sound'}).click();
await page.getByRole('button',{name:'Close',exact:true}).click();
const beforeCryingSound=await page.evaluate(()=>window.petSoundCount);
for(let i=0;i<4;i++)await page.getByRole('button',{name:'Poke Sallu',exact:true}).click();
assert.equal(await page.locator('.sallu-pet').getAttribute('data-pose'),'crying');
assert.ok(reactionDialogues.crying.includes(await page.locator('.sallu-pet__bubble').innerText()));
assert.equal(await page.locator('.sallu-pet__tears i').count(),2);
await page.waitForFunction(before=>window.petSoundCount>=before+10,beforeCryingSound);
await page.screenshot({path:`.tmp/sallu-pet/${width}-crying.png`});await page.clock.fastForward(4000);
const tickleBox=await page.locator('.sallu-pet').boundingBox(),belly=await page.locator('.sallu-pet__body').boundingBox();
const tickleX=belly.x+belly.width*.2,tickleY=belly.y+belly.height*.3;
const beforeLaughSound=await page.evaluate(()=>window.petSoundCount);
if(width<768){const touch=await context.newCDPSession(page);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tickleX,y:tickleY}]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tickleX+36,y:tickleY}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();}
else{await page.mouse.move(tickleX,tickleY);await page.mouse.down();await page.mouse.move(tickleX+36,tickleY,{steps:6});await page.mouse.up();}
assert.equal(await page.locator('.sallu-pet').getAttribute('data-pose'),'laughing');
await page.waitForFunction(before=>window.petSoundCount>=before+14,beforeLaughSound);
assert.ok(reactionDialogues.laughing.includes(await page.locator('.sallu-pet__bubble').innerText()));
assert.deepEqual(await page.locator('.sallu-pet').boundingBox(),tickleBox,'Tickling must not reposition the pet');
await page.screenshot({path:`.tmp/sallu-pet/${width}-laughing.png`});await page.clock.fastForward(3000);
if(width>767){await page.mouse.move(tickleX,tickleY);await page.mouse.move(tickleX+40,tickleY,{steps:6});assert.equal(await page.locator('.sallu-pet').getAttribute('data-pose'),'laughing');await page.clock.fastForward(3000);}
const audioEvidence=await page.evaluate(async()=>{
 const {playPunchSound}=await import('/src/utils/salluPetBehavior.js');const offline=new OfflineAudioContext(1,22050,44100);
 let state='suspended',resumed=false;const proxy=new Proxy(offline,{get:(target,key)=>{if(key==='state')return state;if(key==='resume')return async()=>{await Promise.resolve();state='running';resumed=true;};if(key==='createOscillator')return ()=>{if(!resumed)throw new Error('Scheduled before resume');return target.createOscillator();};return typeof target[key]==='function'?target[key].bind(target):target[key];}});
 await playPunchSound(proxy);const rendered=await offline.startRendering(),data=rendered.getChannelData(0);let peak=0,energy=0;for(const value of data){peak=Math.max(peak,Math.abs(value));energy+=value*value;}return {peak,rms:Math.sqrt(energy/data.length)};
});assert.ok(audioEvidence.peak>.3&&audioEvidence.peak<1);assert.ok(audioEvidence.rms>.1);
const emotions=await page.evaluate(async()=>{
 const {playEmotionSound}=await import('/src/utils/salluPetBehavior.js');const evidence=[];
 for(const emotion of ['laughing','crying']){
  const offline=new OfflineAudioContext(1,44100*3,44100);
  const proxy=new Proxy(offline,{get:(target,key)=>key==='state'?'running':typeof target[key]==='function'?target[key].bind(target):target[key]});
  await playEmotionSound(proxy,emotion);const rendered=await offline.startRendering();
  let peak=0,energy=0;for(const sample of rendered.getChannelData(0)){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
  evidence.push({emotion,peak,rms:Math.sqrt(energy/rendered.length)});
 }return evidence;
});for(const effect of emotions){assert.ok(effect.peak>.01&&effect.peak<1,JSON.stringify(effect));assert.ok(effect.rms>.002,JSON.stringify(effect));}
const soundBefore=await page.evaluate(()=>window.petSoundCount);
const session=width<768?await context.newCDPSession(page):null;
const dragPet=async(part,dx,dy)=>{
 const box=await page.locator('.sallu-pet').boundingBox(),hit=await page.locator(part).boundingBox();const x=hit.x+hit.width/2,y=hit.y+hit.height/2;
 if(session){await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();}
 const after=await page.locator('.sallu-pet').boundingBox();assert.ok(Math.abs(after.x-Math.max(8,Math.min(width-box.width-8,box.x+dx)))<2);assert.ok(Math.abs(after.y-Math.max(12,Math.min(900-box.height-12,box.y+dy)))<2);
 assert.equal(await page.getByRole('dialog',{name:'Sallu',exact:true}).count(),0);assert.equal(await page.locator('.sallu-pet.is-dragging').count(),0);assert.equal(await page.locator('.sallu-pet__bubble').innerText(),'');assert.equal(await page.evaluate(()=>window.petSoundCount),soundBefore);
};
await dragPet('.sallu-pet__body',-140,-180);await dragPet('.sallu-pet__face',-120,-120);await dragPet('.sallu-pet__body',-2000,-2000);await page.screenshot({path:'.tmp/sallu-pet/'+width+'-drag.png'});
if(width>767){await dragPet('.sallu-pet__body',650,400);const box=await page.locator('.sallu-pet').boundingBox();for(const [dx,dy]of [[-200,-200],[0,-200],[200,-200],[-300,0],[300,0],[-200,200],[0,200],[200,200]]){await page.clock.fastForward(150);await page.mouse.move(box.x+box.width/2+dx,box.y+box.height*.28+dy);assert.equal(await page.locator('.sallu-pet').getAttribute('data-pose'),cursorPose(dx,dy));}await page.screenshot({path:'.tmp/sallu-pet/gaze.png'});}
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);await context.close();
}console.log('Desktop/mobile belly tickling, laughter, repeat-hit crying, expression dialogue, sidebar toggle, approval nod, sound/mute, chat, roaming, dragging, 15 shuffled reactions, 16 gaze angles and viewport bounds passed.');}finally{await browser.close();}
