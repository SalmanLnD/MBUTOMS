import test from 'node:test';
import assert from 'node:assert/strict';
import { isStomachSwipe, recentPunches, reactionDialogue, reactionDialogues, punchReactions } from './salluPetBehavior.js';

test('fast belly swipes tickle while vertical and held drags move the pet', () => {
  for (const size of [96, 144]) {
    assert.equal(isStomachSwipe(36, 3, 100, size), true);
    assert.equal(isStomachSwipe(-36, -3, 200, size), true);
    assert.equal(isStomachSwipe(36, 3, 300, size), false);
    assert.equal(isStomachSwipe(4, 0, 100, size), false);
    assert.equal(isStomachSwipe(35, 70, 100, size), false);
  }
});
test('only four hits inside the recent window trigger the crying streak', () => {
  let hits = [];
  for (const time of [0, 500, 1000, 1500]) hits = recentPunches(hits, time);
  assert.equal(hits.length, 4);
  assert.deepEqual(recentPunches(hits, 6000), [6000]);
  assert.deepEqual(recentPunches([0, 3000], 4000), [3000, 4000]);
});
test('every punch, laugh and cry has matching varied dialogue', () => {
  for (const expression of [...punchReactions, 'laughing', 'crying']) {
    const first = reactionDialogue(expression, undefined, () => 0);
    const next = reactionDialogue(expression, first, () => 0);
    assert.ok(reactionDialogues[expression].includes(first));
    assert.ok(reactionDialogues[expression].includes(next));
    assert.notEqual(next, first);
  }
  assert.equal(new Set(punchReactions.map(expression => reactionDialogue(expression, undefined, () => 0))).size, 15);
});
