import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSubjectEndDate, resolveSubjectEndDate } from '../../utils/subjectTrainingDates.js';
import { addSubjectDateExclusions, getUncancelledScheduleDateKeys, hasUncancelledClassOnDate } from '../../utils/leaveAffectedClasses.js';
import { getAttendanceCalendarDates } from '../../utils/attendanceDates.js';
import { collectRrdDateKeys, planExcessRrdAttendanceTypes } from '../../utils/replacementRequiredDays.js';
import { resolveApprovedLeaveAttendanceType } from '../../utils/trainerAttendanceTypes.js';
import Subject from '../../models/Subject.js';
import { migrateSubjectEndDates } from '../../utils/migrateSubjectEndDates.js';
import { getScheduleSubjectRange } from '../../utils/subjectStartDate.js';

const key = date => date.toISOString().slice(0,10);
test('all subjects end Nov 6 except DSAP, QAVA and PSTJ and their real course codes',()=>{
 for(const code of ['DSAP','QAVA','PSTJ','25CA202009','22CA102006','22LG101702']) assert.equal(key(defaultSubjectEndDate({code})),'2026-11-10');
 for(const code of ['IDSA','PSTP','LRRE','NEW']) assert.equal(key(defaultSubjectEndDate({code})),'2026-11-06');
 assert.equal(key(resolveSubjectEndDate({code:'DSAP',endDate:'2026-11-12'})),'2026-11-12');
 const subject = new Subject({name:'Data Structures and Algorithms Using Python',code:'25CA202009',startDate:'2026-07-13'});
 assert.equal(key(subject.endDate),'2026-11-10');
 assert.equal(key(getScheduleSubjectRange({subject:subject._id,subjectCode:'25CA202009'}, {byId:new Map(),byCode:new Map()}).endDate),'2026-11-10');
});
test('inclusive subject cutoffs remove post-training occurrences and RRD across mixed leave ranges',()=>{
 const schedules=[{_id:'normal',subject:'normal',day:'Friday'},{_id:'dsap',subject:'dsap',day:'Tuesday'}];
 const dates=getAttendanceCalendarDates('2026-11-01','2026-11-20');
 const subjectDates={byId:new Map([['normal',{startDate:new Date('2026-07-13'),endDate:new Date('2026-11-06')}],['dsap',{startDate:new Date('2026-07-13'),endDate:new Date('2026-11-10')}]]),byCode:new Map()};
 const exclusions=addSubjectDateExclusions(new Map(),schedules,dates,subjectDates);
 const leave={startDate:'2026-11-01',endDate:'2026-11-20'};
 assert.deepEqual(getUncancelledScheduleDateKeys(leave,schedules[0],exclusions),['2026-11-06']);
 assert.deepEqual(getUncancelledScheduleDateKeys(leave,schedules[1],exclusions),['2026-11-03','2026-11-10']);
 const keys=collectRrdDateKeys({dates,leaveDateKeys:new Set(dates.map(key)),schedules,cancellationMap:exclusions});
 assert.deepEqual(keys,['2026-11-03','2026-11-06','2026-11-10']);
 assert.deepEqual(planExcessRrdAttendanceTypes(keys).eLeaveKeys,['2026-11-06','2026-11-10']);
 assert.equal(resolveApprovedLeaveAttendanceType(false,'e_leave',false),'leave');
});
test('approved Sunday leave is L.W.O with no RRD or replacement occurrence',()=>{
 assert.equal(resolveApprovedLeaveAttendanceType(true,undefined),'lwo');
 assert.equal(resolveApprovedLeaveAttendanceType(true,'leave'),'lwo');
 assert.equal(resolveApprovedLeaveAttendanceType(true,'e_leave'),'lwo');
 assert.equal(resolveApprovedLeaveAttendanceType(false,'leave'),'leave');
 const slot={_id:'sun',day:'Sunday'};
 assert.equal(hasUncancelledClassOnDate([slot],'2026-11-01','Sunday'),false);
 assert.deepEqual(getUncancelledScheduleDateKeys({startDate:'2026-11-01',endDate:'2026-11-01'},slot),[]);
});
test('migration backfills missing end dates without overwriting dates edited by an admin',async t=>{
 const writes=[];
 t.mock.method(Subject,'find',()=>({select:()=>({lean:async()=>[{_id:'one',code:'IDSA'},{_id:'two',code:'25CA202009'}]})}));
 t.mock.method(Subject,'bulkWrite',async rows=>writes.push(...rows));
 await migrateSubjectEndDates();
 assert.equal(key(writes[0].updateOne.update.$set.endDate),'2026-11-06');
 assert.equal(key(writes[1].updateOne.update.$set.endDate),'2026-11-10');
 assert.ok(writes.every(row=>row.updateOne.filter.$or));
});
