import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOD_ALLOWANCE_LABELS,
  FOOD_ALLOWANCE_TYPES,
  formatFoodAllowance,
  isValidFoodAllowance,
} from '../../utils/foodAllowanceTypes.js';

test('defines the requested daily food allowance combinations', () => {
  assert.deepEqual(Object.values(FOOD_ALLOWANCE_LABELS), [
    'Breakfast',
    'Lunch',
    'Dinner',
    'Breakfast, Lunch',
    'Breakfast, Dinner',
    'Lunch, Dinner',
    'Breakfast, Lunch, Dinner',
  ]);
});

test('accepts blank or configured food allowances only', () => {
  assert.equal(isValidFoodAllowance(''), true);
  assert.equal(isValidFoodAllowance(FOOD_ALLOWANCE_TYPES.BREAKFAST_LUNCH), true);
  assert.equal(isValidFoodAllowance('snacks'), false);
  assert.equal(
    formatFoodAllowance(FOOD_ALLOWANCE_TYPES.BREAKFAST_LUNCH_DINNER),
    'Breakfast, Lunch, Dinner'
  );
  assert.equal(formatFoodAllowance(''), 'none');
  assert.equal(formatFoodAllowance(undefined), 'none');
});
