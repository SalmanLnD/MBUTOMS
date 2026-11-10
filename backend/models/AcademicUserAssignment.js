import mongoose from 'mongoose';
import { termModel } from '../utils/academicTermContext.js';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  coordinatorSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  evaluatorSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
}, { timestamps: true, collection: 'academic_user_assignments' });

export default termModel('AcademicUserAssignment', schema);
