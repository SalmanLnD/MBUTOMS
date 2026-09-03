import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_FEEDBACK_FIELDS,
  formatFeedbackClassLabel,
  mergeDefaultFeedbackFields,
} from '../../utils/feedbackDefaults.js';

describe('mergeDefaultFeedbackFields', () => {
  it('inserts class and semester after name and roll number', () => {
    const merged = mergeDefaultFeedbackFields([
      { id: 'student_name', type: 'short_text', label: 'Name of the student', required: true, order: 0 },
      { id: 'roll_number', type: 'short_text', label: 'Full roll number of the student', required: true, order: 1 },
      { id: 'trainer', type: 'trainer_select', label: 'Trainer name', required: true, order: 2 },
      { id: 'rating', type: 'rating', label: 'Ratings', required: true, order: 3 },
      { id: 'comments', type: 'paragraph', label: 'Comments', required: true, order: 4 },
    ]);

    assert.deepEqual(
      merged.map((field) => field.id),
      DEFAULT_FEEDBACK_FIELDS.map((field) => field.id)
    );
    assert.equal(merged[2].type, 'class_select');
    assert.equal(merged[3].type, 'semester_select');
    assert.equal(merged[4].id, 'trainer');
  });

  it('absorbs September-style class and semester questions instead of duplicating them', () => {
    const merged = mergeDefaultFeedbackFields([
      { id: 'student_name', type: 'short_text', label: 'Name of the student', required: true, order: 0 },
      { id: 'roll_number', type: 'short_text', label: 'Full roll number of the student', required: true, order: 1 },
      { id: 'field_class', type: 'multiple_choice', label: 'Class', required: true, order: 2, options: ['CSE A1'] },
      { id: 'field_sem', type: 'multiple_choice', label: 'Semester', required: true, order: 3, options: ['III'] },
      { id: 'trainer', type: 'trainer_select', label: 'Trainer name', required: true, order: 4 },
    ]);

    assert.equal(merged.filter((field) => field.id === 'student_class').length, 1);
    assert.equal(merged.filter((field) => field.id === 'semester').length, 1);
    assert.equal(merged.some((field) => field.id === 'field_class' || field.id === 'field_sem'), false);
    assert.equal(merged.find((field) => field.id === 'student_class').type, 'class_select');
    assert.equal(merged.find((field) => field.id === 'semester').type, 'semester_select');
  });
});

describe('formatFeedbackClassLabel', () => {
  it('uses department and section, and adds semester when labels collide', () => {
    const classes = [
      { department: 'CSE', section: 'A1', currentSemester: 'III' },
      { department: 'CSE', section: 'A1', currentSemester: 'V' },
    ];
    assert.equal(
      formatFeedbackClassLabel(classes[0], classes),
      'CSE A1 · Sem III'
    );
    assert.equal(
      formatFeedbackClassLabel({ department: 'AIML', section: 'B1', currentSemester: 'III' }, classes),
      'AIML B1'
    );
  });
});
