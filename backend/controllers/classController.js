import Schedule from '../models/Schedule.js';
import Batch from '../models/Batch.js';
import Student from '../models/Student.js';

const classKey = (department, section) => `${department}::${section}`;

export const getClasses = async (req, res) => {
  const [scheduleGroups, batches, students] = await Promise.all([
    Schedule.aggregate([
      ...(req.query.semester ? [{ $match: { semester: req.query.semester } }] : []),
      {
        $group: {
          _id: { department: '$department', section: '$section' },
          slotCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.department': 1, '_id.section': 1 } },
    ]),
    Batch.find()
      .populate({ path: 'section', populate: { path: 'department', select: 'name code' } })
      .populate('semester', 'name number')
      .sort({ name: 1 }),
    Student.find({ status: 'active' }).select('branch sectionLabel batch'),
  ]);

  const classMap = new Map();

  scheduleGroups.forEach((group) => {
    const department = group._id.department;
    const section = group._id.section;
    const key = classKey(department, section);
    classMap.set(key, {
      id: key,
      department,
      section,
      label: `${department} ${section}`,
      source: 'timetable',
      slotCount: group.slotCount,
      studentCount: 0,
      batchId: null,
    });
  });

  batches.forEach((batch) => {
    const department = batch.section?.department?.code || batch.section?.department?.name || '';
    const section = batch.section?.name || batch.name;
    const key = classKey(department, section);
    const existing = classMap.get(key);
    if (existing) {
      existing.batchId = batch._id;
      existing.studentCount = batch.studentCount || existing.studentCount;
      existing.batchName = batch.name;
      existing.semester = batch.semester?.name;
    } else {
      classMap.set(key, {
        id: key,
        department,
        section,
        label: batch.name,
        source: 'batch',
        slotCount: 0,
        studentCount: batch.studentCount || 0,
        batchId: batch._id,
        batchName: batch.name,
        semester: batch.semester?.name,
      });
    }
  });

  students.forEach((student) => {
    const department = student.branch || '';
    const section = student.sectionLabel || '';
    if (!department || !section) return;
    const key = classKey(department, section);
    const entry = classMap.get(key);
    if (entry) {
      entry.studentCount += 1;
    } else {
      classMap.set(key, {
        id: key,
        department,
        section,
        label: `${department} ${section}`,
        source: 'students',
        slotCount: 0,
        studentCount: 1,
        batchId: student.batch || null,
      });
    }
  });

  const classes = [...classMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
  );

  res.json(classes);
};
