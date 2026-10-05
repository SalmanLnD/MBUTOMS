import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, isDemoUser, demoNetworkActions } from './demoWorkspace.js';
const storage = () => { const map=new Map(); return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}; };

test('local CRUD survives refresh, is reflected in nested data, and never crosses accounts', () => {
  const store=storage(), ws=createDemoWorkspace(store);
  const live={subjects:[{_id:'s1',name:'Original',code:'ABC'}],pagination:{total:1}};
  ws.remember('demo','/subjects',{},live);
  ws.mutate('demo','/subjects/s1','put',{name:'Demo title'});
  assert.equal(ws.project('demo','/subjects',{},live).subjects[0].name,'Demo title');
  assert.equal(ws.project('real-admin','/subjects',{},live).subjects[0].name,'Original');
  assert.equal(live.subjects[0].name,'Original');
  const fresh=createDemoWorkspace(store);
  assert.equal(fresh.project('demo','/subjects',{},live).subjects[0].name,'Demo title');
  assert.equal(fresh.project('demo','/schedules',{},[{subject:live.subjects[0]}])[0].subject.name,'Demo title');
  const created=ws.mutate('demo','/subjects','post',{name:'New local subject'});
  assert.equal(ws.project('demo','/subjects',{},live).subjects.length,2);
  assert.equal(ws.localDetail('demo',`/subjects/${created._id}`).name,'New local subject');
  ws.mutate('demo','/subjects/s1','delete');
  assert.equal(ws.project('demo','/subjects',{},live).subjects.length,1);
  ws.reset('demo'); assert.deepEqual(ws.project('demo','/subjects',{},live),live);
});

test('attendance, topics, marks and observations stay local when refreshed',()=>{
  const ws=createDemoWorkspace(storage()), owner='demo';
  ws.mutate(owner,'/attendance/trainer-daily','put',{trainer:'t1',date:'2026-10-05',attendanceType:'work',mockPrepHours:2});
  const grid=ws.project(owner,'/attendance/trainer-grid',{}, {month:'2026-10',rows:[{trainer:{_id:'t1'},days:{'2026-10-05':{mockPrepHours:0}}}]});
  assert.equal(grid.rows[0].days['2026-10-05'].mockPrepHours,2);
  ws.mutate(owner,'/topic-tracker/entries','put',{scheduleId:'sc1',date:'2026-10-05',topicModulesCovered:['Arrays'],trackerStatus:'closed',sessionStartTime:'09:00',sessionEndTime:'11:00'});
  const tracker=ws.project(owner,'/topic-tracker/sessions',{}, {sessions:[{scheduleId:'sc1',date:'2026-10-05'}]}).sessions[0];
  assert.deepEqual(tracker.topicModulesCovered,['Arrays']); assert.equal(tracker.durationHrs,2);
  ws.mutate(owner,'/student-test-reports/bulk','put',{month:'2026-10',subject:'s1',entries:[{studentId:'u1',attendance:'P',marksObtained:45,maxMarks:50}]});
  const marks=ws.project(owner,'/student-test-reports/grid',{month:'2026-10',subject:'s1'},{students:[{_id:'u1',report:null}]}).students[0].report;
  assert.equal(marks.marksObtained,45); assert.equal(marks.percentage,90);
  ws.mutate(owner,'/observations/t1','put',{monthKey:'2026-10',type:'class',rating:4,comments:'Local rating'});
  assert.equal(ws.project(owner,'/observations',{}, {monthKey:'2026-10',type:'class',trainers:[{trainerId:'t1'}]}).trainers[0].rating,4);
});

test('local integrations do not produce server credentials, and unknown actions fail closed',()=>{
  const ws=createDemoWorkspace(storage());
  ws.mutate('demo','/attendance/sheets/link','post',{spreadsheetUrl:'https://example.invalid/demo'});
  assert.equal(ws.project('demo','/attendance/sheets/status',{}, {linked:false}).linked,true);
  assert.throws(()=>ws.mutate('demo','/unknown-write','post',{}),/No data was sent/);
  assert.ok(isDemoUser({role:'demo'})); assert.ok(isDemoUser({role:'admin',isDemo:true}));
  assert.equal(isDemoUser({role:'admin'}),false);
  assert.ok(demoNetworkActions.has('/ai/chat')); assert.equal(demoNetworkActions.has('/subjects'),false);
});
