import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAllowedDepartmentCodesForSubject,
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
