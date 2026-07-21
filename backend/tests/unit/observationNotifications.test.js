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
});
