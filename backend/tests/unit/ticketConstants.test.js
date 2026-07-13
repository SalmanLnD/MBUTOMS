import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TICKET_TYPES,
  TICKET_STATUSES,
  TICKET_TYPE_LABELS,
  TICKET_STATUS_LABELS,
} from '../../utils/ticketConstants.js';

describe('ticket constants', () => {
  it('defines five ticket types with labels', () => {
    assert.equal(TICKET_TYPES.length, 5);
    assert.equal(TICKET_TYPE_LABELS.college_issue, 'College Issue');
    assert.equal(TICKET_TYPE_LABELS.coordinator_issue, 'Coordinator Issue');
    assert.equal(TICKET_TYPE_LABELS.venue_issue, 'Venue Issue');
    assert.equal(TICKET_TYPE_LABELS.accommodation_issue, 'Accommodation Issue');
    assert.equal(TICKET_TYPE_LABELS.trainer_issue, 'Trainer Issue');
  });

  it('defines three ticket statuses with labels', () => {
    assert.deepEqual(TICKET_STATUSES, ['pending', 'solving', 'closed']);
    assert.equal(TICKET_STATUS_LABELS.pending, 'Pending');
    assert.equal(TICKET_STATUS_LABELS.solving, 'Solving');
    assert.equal(TICKET_STATUS_LABELS.closed, 'Closed');
  });
});
