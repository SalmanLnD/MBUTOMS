import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getStudentCountForClass,
  resolveAllottedStudents,
} from '../../utils/studentCountByClass.js';

describe('getStudentCountForClass', () => {
  it('sums ECE and EIE students for ECE & EIE classes', () => {
    const map = new Map([
      ['ECE::1', 20],
      ['EIE::1', 15],
    ]);
    assert.equal(getStudentCountForClass(map, 'ECE & EIE', '1'), 35);
  });

  it('uses direct department match when present', () => {
    const map = new Map([['CSE::A', 40]]);
    assert.equal(getStudentCountForClass(map, 'CSE', 'A'), 40);
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
