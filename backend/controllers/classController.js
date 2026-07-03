import ClassGroup from '../models/ClassGroup.js';
import Student from '../models/Student.js';
import Schedule from '../models/Schedule.js';

const attachStudentCounts = async (classes) => {
  const counts = await Student.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: { department: '$branch', section: '$sectionLabel' },
        studentCount: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(
    counts.map((row) => [
      `${row._id.department}::${row._id.section}`,
      row.studentCount,
    ])
  );

  return classes.map((cls) => {
    const key = `${cls.department}::${cls.section}`;
    return {
      ...cls,
      studentCount: countMap.get(key) || 0,
      label: `${cls.department} ${cls.section}`,
    };
  });
};

export const getClasses = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.semester) filter.currentSemester = req.query.semester;

  const classes = await ClassGroup.find(filter)
    .sort({ department: 1, section: 1, py: 1 })
    .lean();

  res.json(await attachStudentCounts(classes));
};

export const getClassById = async (req, res) => {
  const cls = await ClassGroup.findById(req.params.id).lean();
  if (!cls) return res.status(404).json({ message: 'Class not found' });
  const [withCount] = await attachStudentCounts([cls]);
  res.json(withCount);
};

export const createClass = async (req, res) => {
  const payload = {
    department: String(req.body.department || '').trim(),
    section: String(req.body.section || '').trim(),
    py: Number(req.body.py),
    currentSemester: String(req.body.currentSemester || '').trim(),
    status: req.body.status || 'active',
  };

  const duplicate = await ClassGroup.findOne({
    department: payload.department,
    section: payload.section,
    currentSemester: payload.currentSemester,
  });
  if (duplicate) {
    return res.status(409).json({
      message: `Class ${payload.department} ${payload.section} (Sem ${payload.currentSemester}) already exists.`,
    });
  }

  const cls = await ClassGroup.create(payload);
  const [withCount] = await attachStudentCounts([cls.toObject()]);
  res.status(201).json(withCount);
};

export const updateClass = async (req, res) => {
  const cls = await ClassGroup.findById(req.params.id);
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  const nextDepartment = String(req.body.department ?? cls.department).trim();
  const nextSection = String(req.body.section ?? cls.section).trim();
  const nextPy = Number(req.body.py ?? cls.py);
  const nextSemester = String(req.body.currentSemester ?? cls.currentSemester).trim();

  const duplicate = await ClassGroup.findOne({
    _id: { $ne: cls._id },
    department: nextDepartment,
    section: nextSection,
    currentSemester: nextSemester,
  });
  if (duplicate) {
    return res.status(409).json({
      message: `Class ${nextDepartment} ${nextSection} (Sem ${nextSemester}) already exists.`,
    });
  }

  const oldDepartment = cls.department;
  const oldSection = cls.section;
  const oldSemester = cls.currentSemester;

  cls.department = nextDepartment;
  cls.section = nextSection;
  cls.py = nextPy;
  cls.currentSemester = nextSemester;
  if (req.body.status) cls.status = req.body.status;

  await cls.save();

  if (
    oldDepartment !== nextDepartment
    || oldSection !== nextSection
    || oldSemester !== nextSemester
  ) {
    await Schedule.updateMany(
      { department: oldDepartment, section: oldSection, semester: oldSemester },
      {
        $set: {
          department: nextDepartment,
          section: nextSection,
          semester: nextSemester,
        },
      }
    );
  }

  const [withCount] = await attachStudentCounts([cls.toObject()]);
  res.json(withCount);
};

export const deleteClass = async (req, res) => {
  const cls = await ClassGroup.findById(req.params.id);
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  const scheduleCount = await Schedule.countDocuments({
    department: cls.department,
    section: cls.section,
    semester: cls.currentSemester,
  });
  if (scheduleCount > 0) {
    return res.status(409).json({
      message: `Cannot delete class while ${scheduleCount} timetable slot(s) still reference it.`,
    });
  }

  await cls.deleteOne();
  res.json({ message: 'Class removed' });
};
