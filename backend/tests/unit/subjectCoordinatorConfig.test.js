import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECT_COORDINATOR_ASSIGNMENTS } from '../../utils/subjectCoordinatorConfig.js';
import { LRRE_SUBJECT_CODE } from '../../utils/lrreVSemesterTimetable.js';
import { QAVA_SUBJECT_CODE } from '../../utils/subjectSlotTimings.js';
import { IDSA_SUBJECT, PSTP_SUBJECT } from '../../utils/trainerMappings.js';

describe('subject coordinator config', () => {
  it('assigns Ravi Teja to LRRE and QAVA, and Sai Priya and Navya to PSTP and IDSA', () => {
    assert.equal(SUBJECT_COORDINATOR_ASSIGNMENTS.length, 4);

    const ravi = SUBJECT_COORDINATOR_ASSIGNMENTS.filter((entry) => entry.employeeId === '135130');
    const saiPriya = SUBJECT_COORDINATOR_ASSIGNMENTS.find((entry) => entry.employeeId === '131886');
    const navya = SUBJECT_COORDINATOR_ASSIGNMENTS.find((entry) => entry.employeeId === '135301');

    assert.deepEqual(
      ravi.map((entry) => entry.subjectCode),
      [LRRE_SUBJECT_CODE, QAVA_SUBJECT_CODE]
    );
    assert.equal(saiPriya.subjectCode, PSTP_SUBJECT.code);
    assert.equal(navya.subjectCode, IDSA_SUBJECT.code);
  });
});
