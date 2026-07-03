import Schedule from '../models/Schedule.js';
import Student from '../models/Student.js';
import Semester from '../models/Semester.js';
import ClassGroup from '../models/ClassGroup.js';
import { defaultPyForSemester, semesterNameToRoman, syncClassPyBySemester } from './classRegistry.js';

const normalizeKey = (department, section, semester) =>
  `${department}::${section}::${semester}`;

export const migrateClassesFromSchedules = async () => {
  const activeSemester = await Semester.findOne({ isActive: true }).select('name number');
  const fallbackSemester = semesterNameToRoman(activeSemester?.name, activeSemester?.number);

  const scheduleGroups = await Schedule.aggregate([
    {
      $group: {
        _id: {
          department: '$department',
          section: '$section',
          semester: '$semester',
        },
      },
    },
  ]);

  const studentGroups = await Student.aggregate([
    { $match: { status: 'active', branch: { $ne: '' }, sectionLabel: { $ne: '' } } },
    {
      $group: {
        _id: {
          department: '$branch',
          section: '$sectionLabel',
        },
      },
    },
  ]);

  const pending = new Map();

  scheduleGroups.forEach((group) => {
    const department = String(group._id.department || '').trim();
    const section = String(group._id.section || '').trim();
    const semester = String(group._id.semester || fallbackSemester).trim() || fallbackSemester;
    if (!department || !section) return;
    pending.set(normalizeKey(department, section, semester), { department, section, semester });
  });

  studentGroups.forEach((group) => {
    const department = String(group._id.department || '').trim();
    const section = String(group._id.section || '').trim();
    const semester = fallbackSemester;
    if (!department || !section) return;
    const key = normalizeKey(department, section, semester);
    if (!pending.has(key)) {
      pending.set(key, { department, section, semester });
    }
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of pending.values()) {
    const py = defaultPyForSemester(entry.semester);
    const existing = await ClassGroup.findOne({
      department: entry.department,
      section: entry.section,
      currentSemester: entry.semester,
    });

    if (existing) {
      let changed = false;
      if (existing.currentSemester !== entry.semester) {
        existing.currentSemester = entry.semester;
        changed = true;
      }
      if (existing.py !== py) {
        existing.py = py;
        changed = true;
      }
      if (existing.status !== 'active') {
        existing.status = 'active';
        changed = true;
      }
      if (changed) {
        await existing.save();
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await ClassGroup.create({
      department: entry.department,
      section: entry.section,
      py,
      currentSemester: entry.semester,
      status: 'active',
    });
    created += 1;
  }

  const pySync = await syncClassPyBySemester();

  return { created, updated, skipped, total: pending.size, pySync };
};
