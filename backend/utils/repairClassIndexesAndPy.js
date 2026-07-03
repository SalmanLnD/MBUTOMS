import ClassGroup from '../models/ClassGroup.js';
import { syncClassPyBySemester } from './classRegistry.js';

export const repairClassIndexesAndPy = async () => {
  const collection = ClassGroup.collection;

  try {
    await collection.dropIndex('department_1_section_1_py_1');
  } catch {
    // Index may not exist
  }

  try {
    await ClassGroup.syncIndexes();
  } catch (err) {
    console.warn('Class index sync warning:', err.message);
  }

  return syncClassPyBySemester();
};
