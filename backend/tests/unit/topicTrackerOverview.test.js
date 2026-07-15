import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeOverviewTrainerNames } from '../../utils/topicTrackerSessions.js';

test('trainer overview shows original and replacement trainers with slash separation', () => {
  const names = mergeOverviewTrainerNames([], {
    trainerName: 'Jahnavi M',
    originalTrainerName: 'Jakka Rounak Reddy',
    replacementTrainerName: 'Jahnavi M',
  });

  assert.equal(names.join(' / '), 'Jakka Rounak Reddy / Jahnavi M');
});

test('trainer overview does not duplicate names across multiple replaced slots', () => {
  const session = {
    originalTrainerName: 'Jakka Rounak Reddy',
    replacementTrainerName: 'Jahnavi M',
  };
  const names = mergeOverviewTrainerNames(
    mergeOverviewTrainerNames([], session),
    session
  );

  assert.deepEqual(names, ['Jakka Rounak Reddy', 'Jahnavi M']);
});
