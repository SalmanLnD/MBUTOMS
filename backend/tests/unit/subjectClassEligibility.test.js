import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAllowedDepartmentCodesForSubject,
  expandAllowedClassDepartments,
  getDepartmentCodesForClassDepartment,
} from '../../utils/subjectClassEligibility.js';

describe('getDepartmentCodesForClassDepartment', () => {
  it('maps combined and aliased class labels to reference department codes', () => {
    assert.deepEqual(getDepartmentCodesForClassDepartment('ECE & EIE'), ['ECE', 'EIE']);
    assert.deepEqual(getDepartmentCodesForClassDepartment('CE & ME'), ['CE-ME']);
    assert.deepEqual(getDepartmentCodesForClassDepartment('B.COM(CA)'), ['BCOM-CA']);
  });

  it('uses the class department itself when no alias applies', () => {
    assert.deepEqual(getDepartmentCodesForClassDepartment(' CSE '), ['CSE']);
    assert.deepEqual(getDepartmentCodesForClassDepartment(''), []);
  });
});

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

  it('adds B.COM(CA) when BCOM-CA is allowed', () => {
    assert.deepEqual(
      expandAllowedClassDepartments(['BCOM-CA', 'BCA']).sort(),
      ['BCA', 'BCOM-CA', 'B.COM(CA)'].sort()
    );
  });

  it('leaves unrelated codes unchanged', () => {
    assert.deepEqual(expandAllowedClassDepartments(['CSE', 'AIML']), ['CSE', 'AIML']);
  });
});
