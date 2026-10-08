import {test} from 'node:test';
import assert from 'node:assert/strict';
import User from '../../models/User.js';
import Trainer from '../../models/Trainer.js';
import { getHiddenRosterTrainerIds } from '../../utils/rosterFilter.js';
import { ADMIN_TRAINER_EMPLOYEE_ID } from '../../utils/trainerMappings.js';

test('admin punch-in linkage does not hide Salman attendance; other roster rules remain', async t => {
  t.mock.method(User,'find',() => ({select:() => ({lean:async () => [{trainer:'salman'},{trainer:'manager'}]})}));
  t.mock.method(Trainer,'findOne',filter => {
    assert.equal(filter.employeeId,ADMIN_TRAINER_EMPLOYEE_ID);
    return {select:() => ({lean:async () => ({_id:'salman'})})};
  });
  assert.deepEqual(await getHiddenRosterTrainerIds(),['salman','manager']);
  assert.deepEqual(await getHiddenRosterTrainerIds({attendance:true}),['manager']);
});
