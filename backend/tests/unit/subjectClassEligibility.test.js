import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAllowedDepartmentCodesForSubject,
  expandAllowedClassDepartments,
} from '../../utils/subjectClassEligibility.js';

describe('getAllowedDepartmentCodesForSubject', () => {
  it('returns specific department codes when populated on the subject', async () => {
    const codes = await getAllowedDepartmentCodesForSubject({
      allDepartments: false,
      schools: [{ _id: 'school-1', code: 'SOLAS' }],
      departments: [{ _id: 'dept-1', code: 'BCA' }, { _id: 'dept-2', code: 'BSC-CS' }],
    });
    assert.deepEqual(codes, ['BCA', 'BSC-CS']);
  });

  it('returns null when no department restriction is configured', async () => {
    const codes = await getAllowedDepartmentCodesForSubject({
      allDepartments: false,
      schools: [],
      departments: [],
    });
    assert.equal(codes, null);
  });

  it('returns null when subject is missing', async () => {
    const codes = await getAllowedDepartmentCodesForSubject(null);
    assert.equal(codes, null);
  });
});

describe('expandAllowedClassDepartments', () => {
  it('adds ECE & EIE when ECE or EIE is allowed', () => {
    assert.deepEqual(
      expandAllowedClassDepartments(['EEE', 'ECE', 'EIE']).sort(),
      ['ECE', 'ECE & EIE', 'EEE', 'EIE'].sort()
    );
  });

  it('adds CE & ME when CE-ME is allowed', () => {
    assert.deepEqual(
      expandAllowedClassDepartments(['CE-ME']).sort(),
      ['CE & ME', 'CE-ME'].sort()
    );
  });

  it('leaves unrelated codes unchanged', () => {
    assert.deepEqual(expandAllowedClassDepartments(['CSE', 'AIML']), ['CSE', 'AIML']);
  });
});
