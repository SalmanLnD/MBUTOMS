import { test } from 'node:test';
import assert from 'node:assert/strict';
import Trainer from '../../models/Trainer.js';
import { getTrainers } from '../../controllers/trainerController.js';
import { migrateTrainerDirectoryStatus } from '../../utils/migrateTrainerDirectoryStatus.js';

const query = rows => ({populate(){return this;},select(){return this;},sort(){return this;},skip(){return this;},limit(){return this;},lean:async()=>rows});
test('directory defaults to active and permits archived/all without legacy employment hiding',async t=>{
 let filter;
 t.mock.method(Trainer,'find',value=>{filter=value;return query([]);});
 t.mock.method(Trainer,'countDocuments',async()=>0);
 const run=async params=>{await getTrainers({query:params,user:{role:'admin'}},{json(){}});return filter;};
 assert.deepEqual(await run({directory:'true'}),{$and:[{},{status:'active'}]});
 assert.deepEqual(await run({directory:'true',status:'archived'}),{status:'archived'});
 assert.deepEqual(await run({directory:'true',status:'all'}),{});
 const operational=JSON.stringify(await run({status:'active'}));
 assert.match(operational,/archived/);assert.match(operational,/directoryReactivatedAt/);
});
test('directory migration preserves existing visible trainers and archives only other uninitialized records',async t=>{
 let pending=true;const writes=[];
 t.mock.method(Trainer,'exists',async()=>pending);
 t.mock.method(Trainer,'find',()=>query([{_id:'current-1'},{_id:'current-2'}]));
 t.mock.method(Trainer,'updateMany',async(filter,update)=>writes.push({filter,update}));
 await migrateTrainerDirectoryStatus();
 assert.equal(writes.length,3);
 assert.equal(writes[0].update.$set.employmentStatus,'active');
 assert.deepEqual(writes[1].filter._id,{$in:['current-1','current-2']});
 assert.equal(writes[1].update.$set.status,'active');
 assert.equal(writes[2].update.$set.status,'archived');
 assert.ok(writes.slice(1).every(write=>write.filter.directoryStatusInitializedAt.$exists===false));
 pending=false;await migrateTrainerDirectoryStatus();assert.equal(writes.length,4);
});
