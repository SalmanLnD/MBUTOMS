import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECT_COORDINATOR_ASSIGNMENTS } from '../../utils/subjectCoordinatorConfig.js';
import { LRRE_SUBJECT_CODE } from '../../utils/lrreVSemesterTimetable.js';
import { IDSA_SUBJECT, PSTP_SUBJECT } from '../../utils/trainerMappings.js';

describe('subject coordinator config', () => {
  it('assigns Ravi Teja, Sai Priya, and Navya to LRRE, PSTP, and IDSA', () => {
    assert.equal(SUBJECT_COORDINATOR_ASSIGNMENTS.length, 3);

    const ravi = SUBJECT_COORDINATOR_ASSIGNMENTS.find((entry) => entry.employeeId === '135130');
    const saiPriya = SUBJECT_COORDINATOR_ASSIGNMENTS.find((entry) => entry.employeeId === '131886');
    const navya = SUBJECT_COORDINATOR_ASSIGNMENTS.find((entry) => entry.employeeId === '135301');

    assert.equal(ravi.subjectCode, LRRE_SUBJECT_CODE);
    assert.equal(saiPriya.subjectCode, PSTP_SUBJECT.code);
    assert.equal(navya.subjectCode, IDSA_SUBJECT.code);
  });
});
