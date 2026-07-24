import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildObservationClassDetail } from '../../utils/observationNotifications.js';

describe('buildObservationClassDetail', () => {
  it('builds class and slot detail without rating', () => {
    const detail = buildObservationClassDetail({
      subjectCode: 'PSTP',
      department: 'ECE & EIE',
      section: '1',
      day: 'Tuesday',
      slot: 'S2',
      startTime: '10:30',
      endTime: '12:30',
    });
    assert.equal(
      detail,
      'PSTP · ECE & EIE 1 · Tuesday · S2 10:30–12:30'
    );
  });

  it('includes observation date when provided', () => {
    const detail = buildObservationClassDetail({
      observationDate: '2026-07-24',
      subjectCode: 'PSTP',
      department: 'ECE',
      section: '1',
      day: 'Thursday',
      slot: 'S1',
      startTime: '09:00',
      endTime: '10:00',
    });
    assert.equal(
      detail,
      '2026-07-24 · PSTP · ECE 1 · Thursday · S1 09:00–10:00'
    );
  });
});
