import AcademicYear from '../models/AcademicYear.js';
import Semester from '../models/Semester.js';
import School from '../models/School.js';
import Department from '../models/Department.js';
import Subject from '../models/Subject.js';

const SEMESTER_DEFS = [
  { name: 'Semester I', number: 1 },
  { name: 'Semester II', number: 2 },
  { name: 'Semester III', number: 3, isActive: true },
  { name: 'Semester IV', number: 4 },
  { name: 'Semester V', number: 5 },
  { name: 'Semester VI', number: 6 },
  { name: 'Semester VII', number: 7 },
  { name: 'Semester VIII', number: 8 },
];

const SCHOOL_DEFS = [
  { name: 'School of Engineering', code: 'SOE' },
  { name: 'School of Computing', code: 'SOC' },
  { name: 'School of Liberal Arts and Science', code: 'SOLAS' },
];

const DEPARTMENT_DEFS = [
  // School of Computing
  { code: 'CSE', name: 'Computer Science and Engineering', school: 'SOC' },
  { code: 'AIML', name: 'Artificial Intelligence and Machine Learning', school: 'SOC' },
  { code: 'DS', name: 'Data Science', school: 'SOC' },
  { code: 'CS', name: 'Cyber Security', school: 'SOC' },
  { code: 'IT', name: 'Information Technology', school: 'SOC' },
  { code: 'AI&DS', name: 'Artificial Intelligence and Data Science', school: 'SOC' },

  // School of Engineering
  { code: 'ECE', name: 'Electronics and Communication Engineering', school: 'SOE' },
  { code: 'EIE', name: 'Electronics and Instrumentation Engineering', school: 'SOE' },
  { code: 'EEE', name: 'Electrical and Electronics Engineering', school: 'SOE' },
  {
    code: 'CE-ME',
    name: 'Civil Engineering and Mechanical Engineering',
    school: 'SOE',
    description: 'CE (Civil) and ME (Mechanical) treated as one class for subjects',
  },

  // School of Liberal Arts and Science
  { code: 'BCA', name: 'Bachelor of Computer Applications', school: 'SOLAS' },
  { code: 'BSC-CS', name: 'B.Sc Computer Science', school: 'SOLAS' },
  { code: 'BCOM-CA', name: 'B.Com Computer Applications', school: 'SOLAS' },
  { code: 'MCA', name: 'Master of Computer Applications', school: 'SOLAS' },
];

const RETIRED_DEPARTMENT_CODES = ['CE', 'ME'];

export const ensureReferenceData = async () => {
  let academicYear = await AcademicYear.findOne({ isActive: true });
  if (!academicYear) {
    academicYear = await AcademicYear.create({
      name: '2025-2026',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    });
  }

  const schoolsByCode = {};
  for (const schoolDef of SCHOOL_DEFS) {
    const school = await School.findOneAndUpdate(
      { code: schoolDef.code },
      schoolDef,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    schoolsByCode[schoolDef.code] = school;
  }

  for (const semesterDef of SEMESTER_DEFS) {
    await Semester.findOneAndUpdate(
      { academicYear: academicYear._id, number: semesterDef.number },
      {
        name: semesterDef.name,
        number: semesterDef.number,
        academicYear: academicYear._id,
        isActive: Boolean(semesterDef.isActive),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const canonicalCodes = DEPARTMENT_DEFS.map((dept) => dept.code);

  for (const deptDef of DEPARTMENT_DEFS) {
    await Department.findOneAndUpdate(
      { code: deptDef.code },
      {
        name: deptDef.name,
        code: deptDef.code,
        school: schoolsByCode[deptDef.school]._id,
        description: deptDef.description || '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const ceMeDept = await Department.findOne({ code: 'CE-ME' });
  const legacyCeDept = await Department.findOne({ code: 'CE' });
  if (ceMeDept && legacyCeDept) {
    await Subject.updateMany({ department: legacyCeDept._id }, { department: ceMeDept._id });
  }

  const removableCodes = [...RETIRED_DEPARTMENT_CODES];
  for (const code of removableCodes) {
    const dept = await Department.findOne({ code });
    if (!dept) continue;

    const inUse = await Subject.exists({ department: dept._id });
    if (!inUse) {
      await dept.deleteOne();
    }
  }

  const allDepartments = await Department.find().select('code');
  for (const dept of allDepartments) {
    if (canonicalCodes.includes(dept.code)) continue;
    const inUse = await Subject.exists({ department: dept._id });
    if (!inUse) {
      await dept.deleteOne();
    }
  }

  const [schoolCount, semesterCount, departmentCount] = await Promise.all([
    School.countDocuments(),
    Semester.countDocuments(),
    Department.countDocuments(),
  ]);

  return { schoolCount, semesterCount, departmentCount };
};
