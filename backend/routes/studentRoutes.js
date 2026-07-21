import express from 'express';
import multer from 'multer';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  downloadStudentBulkTemplate,
  bulkUploadStudents,
} from '../controllers/studentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { studentCreateValidation, studentValidation } from '../utils/validators.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      cb(null, true);
      return;
    }
    cb(new Error('Upload a .xlsx or .csv file'));
  },
});

router.use(protect);

router
  .route('/')
  .get(asyncHandler(getStudents))
  .post(authorize('admin', 'campus_manager'), studentCreateValidation, validate, asyncHandler(createStudent));

router.get(
  '/bulk/template',
  authorize('admin', 'campus_manager'),
  asyncHandler(downloadStudentBulkTemplate)
);

router.post(
  '/bulk',
  authorize('admin', 'campus_manager'),
  (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (error) {
        return res.status(400).json({ message: error.message || 'File upload failed' });
      }
      return next();
    });
  },
  asyncHandler(bulkUploadStudents)
);

router
  .route('/:id')
  .get(asyncHandler(getStudentById))
  .put(authorize('admin', 'campus_manager'), studentValidation, validate, asyncHandler(updateStudent))
  .delete(authorize('admin', 'campus_manager'), asyncHandler(deleteStudent));

export default router;
