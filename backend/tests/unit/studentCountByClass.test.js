import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getStudentCountForClass,
  normalizeSemesterKey,
  resolveAllottedStudents,
} from '../../utils/studentCountByClass.js';

describe('normalizeSemesterKey', () => {
  it('normalizes roman and numeric semester labels', () => {
    assert.equal(normalizeSemesterKey('III'), 'III');
    assert.equal(normalizeSemesterKey('3'), 'III');
    assert.equal(normalizeSemesterKey('Sem V'), 'V');
  });
});

describe('getStudentCountForClass', () => {
  it('sums ECE and EIE students for ECE & EIE classes in the same semester', () => {
    const map = new Map([
      ['ECE::1::III', 20],
      ['EIE::1::III', 15],
      ['ECE::1::V', 8],
    ]);
    assert.equal(getStudentCountForClass(map, 'ECE & EIE', '1', 'III'), 35);
    assert.equal(getStudentCountForClass(map, 'ECE & EIE', '1', 'V'), 8);
  });

  it('does not count III semester students against V semester classes', () => {
    const map = new Map([['CSE::A::III', 40]]);
    assert.equal(getStudentCountForClass(map, 'CSE', 'A', 'III'), 40);
    assert.equal(getStudentCountForClass(map, 'CSE', 'A', 'V'), 0);
  });

  it('uses direct department match when present', () => {
    const map = new Map([['CSE::A::III', 40]]);
    assert.equal(getStudentCountForClass(map, 'CSE', 'A', 'III'), 40);
  });
});

describe('resolveAllottedStudents', () => {
  it('auto-fills from live class count when saved is 0 or missing', () => {
    assert.equal(resolveAllottedStudents(0, 55), 55);
    assert.equal(resolveAllottedStudents(undefined, 55), 55);
    assert.equal(resolveAllottedStudents(null, 55), 55);
  });

  it('keeps a manually saved positive total', () => {
    assert.equal(resolveAllottedStudents(60, 55), 60);
  });
});
