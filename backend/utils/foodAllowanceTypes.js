export const FOOD_ALLOWANCE_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  BREAKFAST_LUNCH: 'breakfast_lunch',
  BREAKFAST_DINNER: 'breakfast_dinner',
  LUNCH_DINNER: 'lunch_dinner',
  BREAKFAST_LUNCH_DINNER: 'breakfast_lunch_dinner',
};

export const FOOD_ALLOWANCE_LABELS = {
  [FOOD_ALLOWANCE_TYPES.BREAKFAST]: 'Breakfast',
  [FOOD_ALLOWANCE_TYPES.LUNCH]: 'Lunch',
  [FOOD_ALLOWANCE_TYPES.DINNER]: 'Dinner',
  [FOOD_ALLOWANCE_TYPES.BREAKFAST_LUNCH]: 'Breakfast, Lunch',
  [FOOD_ALLOWANCE_TYPES.BREAKFAST_DINNER]: 'Breakfast, Dinner',
  [FOOD_ALLOWANCE_TYPES.LUNCH_DINNER]: 'Lunch, Dinner',
  [FOOD_ALLOWANCE_TYPES.BREAKFAST_LUNCH_DINNER]: 'Breakfast, Lunch, Dinner',
};

export const isValidFoodAllowance = (value) =>
  value === '' || Object.values(FOOD_ALLOWANCE_TYPES).includes(value);

export const formatFoodAllowance = (value) =>
  FOOD_ALLOWANCE_LABELS[value] || 'none';
