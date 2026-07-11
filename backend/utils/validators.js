import { body } from 'express-validator';

export const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const trainerValidation = [
  body('employeeId').trim().notEmpty().withMessage('Employee ID is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Valid email is required'),
  body('phone').optional({ values: 'falsy' }).trim(),
  body('experience').optional().isInt({ min: 0 }).withMessage('Experience must be a positive number'),
  body('status')
    .optional()
    .isIn(['active', 'unavailable'])
    .withMessage('Invalid availability status'),
];

export const venueValidation = [
  body('name').trim().notEmpty().withMessage('Venue name is required'),
  body('building').trim().notEmpty().withMessage('Building is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('type')
    .optional()
    .isIn(['classroom', 'lab', 'auditorium', 'seminar_hall', 'other'])
    .withMessage('Invalid venue type'),
];

export const subjectValidation = [
  body('name').trim().notEmpty().withMessage('Subject name is required'),
  body('code').trim().notEmpty().withMessage('Subject code is required'),
  body('oifNumber').trim().notEmpty().withMessage('OIF number is required'),
  body('dealNumber').trim().notEmpty().withMessage('Deal number is required'),
  body('startDate').notEmpty().withMessage('Start date is required'),
  body('hours').optional().isInt({ min: 0 }).withMessage('Hours must be a positive number'),
];

export const scheduleValidation = [
  body('trainerCode').trim().notEmpty().withMessage('Trainer code is required'),
  body('day').isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).withMessage('Invalid day'),
  body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:mm format'),
  body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:mm format'),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('section').trim().notEmpty().withMessage('Section is required'),
  body('semester').optional().trim().notEmpty(),
  body('subjectCode').optional().trim(),
  body('slot').optional().isIn(['S1', 'S2', 'S3', 'S4', '']).withMessage('Invalid slot'),
  body('subject').optional().isMongoId().withMessage('Invalid subject'),
  body('classId').optional().isMongoId().withMessage('Invalid class'),
  body('venue').optional({ values: 'null' }).isMongoId().withMessage('Invalid venue'),
];

export const classValidation = [
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('section').trim().notEmpty().withMessage('Section is required'),
  body('py').isInt({ min: 2000, max: 2100 }).withMessage('PY must be a valid year'),
  body('currentSemester').trim().notEmpty().withMessage('Current semester is required'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
];

export const leaveValidation = [
  body('startDate').notEmpty().withMessage('Start date is required'),
  body('endDate').notEmpty().withMessage('End date is required'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
];

export const attendanceValidation = [
  body('type').isIn(['trainer', 'student']).withMessage('Type must be trainer or student'),
  body('date').notEmpty().withMessage('Date is required'),
  body('status').isIn(['present', 'absent', 'late', 'leave', 'od', 'holiday']).withMessage('Invalid status'),
];

export const studentValidation = [
  body('rollNumber').optional({ values: 'falsy' }).trim().notEmpty().withMessage('Roll number is required'),
  body('name').optional({ values: 'falsy' }).trim().notEmpty().withMessage('Name is required'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Valid email is required'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'graduated'])
    .withMessage('Invalid status'),
];

export const studentCreateValidation = [
  body('rollNumber').trim().notEmpty().withMessage('Roll number is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Valid email is required'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'graduated'])
    .withMessage('Invalid status'),
];
