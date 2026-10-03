import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../../models/User.js';
import { executeAiTool, validateToolArguments } from '../../ai/aiTools.js';
import { buildAiPrompt } from '../../ai/aiPrompt.js';
import { buildHourlyTrainerAvailability } from '../../utils/hourlyTrainerAvailability.js';
const args = { date: '2026-10-05', startTime: '09:00', endTime: '17:00' };
const row = (name, slots, other = {}) => ({ _id: name, name, employeeId: name, secret: 'private', availability: [{ date: args.date, slots, ...other }] });
const slot = (startTime, endTime) => ({ startTime, endTime });
test('hourly windows require the whole hour free and retain exact partial-hour intervals', () => {
  const result = buildHourlyTrainerAvailability({ trainers: [row('Partial', [slot('09:30', '11:00')]), row('Free', [slot('09:00', '17:00')]), row('Leave', [slot('09:00', '17:00')], {onLeave:true})] }, args);
  assert.deepEqual(result.hourly[0].trainers.map(t=>t.name), ['Free']);
  assert.deepEqual(result.hourly[1].trainers.map(t=>t.name), ['Partial', 'Free']);
  assert.equal(result.hourly.length, 8);
  assert.deepEqual(result.trainers[0].freeSlots, [slot('09:30', '11:00')]);
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('future date and work-window validation reject invalid inputs', () => {
  assert.equal(validateToolArguments('get_trainer_availability', {date:args.date}).date, args.date);
  for(const input of [{}, {date:'2026-02-30'}, {date:args.date,startTime:'25:00'}, {date:args.date,startTime:'18:00'}, {date:args.date,endTime:'08:00'}, {date:args.date,trainerId:'unsafe'}, {date:args.date,from:'2026-10-01'}]) assert.throws(()=>validateToolArguments('get_trainer_availability',input));
});
test('management receives a sanitized hourly roster from the existing backend calculation', async t => {
  t.mock.method(User,'find',()=>({select(){return this;},lean:async()=>[]}));
  const result=await executeAiTool('get_trainer_availability',{date:args.date},{user:{role:'admin'}},{
    availabilityRoster:async filter=>{assert.ok(JSON.stringify(filter).includes('showInRoster')); return [{_id:'Free'}];},
    availability:async input=>{assert.equal(input.startDate,args.date);assert.deepEqual(input.trainerIds,['Free']);return {trainers:[row('Free',[slot('09:00','17:00')],{isOfficialHoliday:true})]};}
  });
  assert.equal(result.hourly[7].availableCount,1);assert.equal(result.trainers[0].isOfficialHoliday,true);
});
test('trainer and impersonated admin can only request their own availability', async () => {
  for(const req of [{user:{role:'trainer',trainer:'own'}},{user:{role:'trainer',trainer:'own'},impersonator:{role:'admin'}}]) {
    const deps={findTrainers:async()=>[{_id:'own',name:'Own'}],availability:async input=>{assert.deepEqual(input.trainerIds,['own']);return {trainers:[row('Own',[slot('09:00','17:00')])]};}};
    assert.equal((await executeAiTool('get_trainer_availability',{date:args.date},req,deps)).hourly.length,8);
    assert.equal((await executeAiTool('get_trainer_availability',{date:args.date,trainerName:'Other'},req,deps)).error,'forbidden');
  }
  assert.equal((await executeAiTool('get_trainer_availability',{date:args.date},{user:{role:'trainer'}})).error,'not_found');
});
test('truncated roster is disclosed and prompt directs future hourly questions to new tool', () => {
  const result=buildHourlyTrainerAvailability({trainers:[row('A',[]),row('B',[])]},args,1);
  assert.equal(result.truncated,true);assert.equal(result.totalPermittedTrainers,2);
  assert.match(buildAiPrompt({role:'admin'}),/future-date availability.*get_trainer_availability/s);
});
