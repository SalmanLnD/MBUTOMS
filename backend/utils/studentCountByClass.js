/**
 * Look up active student headcount for a class department + section.
 * Handles combined class labels that store students under constituent branches.
 */
export const getStudentCountForClass = (countMap, department, section) => {
  if (!department || section == null || section === '') return 0;

  const key = (dept) => `${dept}::${section}`;
  const direct = countMap.get(key(department));
  if (direct) return direct;

  if (department === 'ECE & EIE') {
    return (countMap.get(key('ECE')) || 0) + (countMap.get(key('EIE')) || 0);
  }

  if (department === 'CE & ME' || department === 'CE-ME') {
    return countMap.get(key('CE-ME'))
      || countMap.get(key('CE & ME'))
      || (countMap.get(key('CE')) || 0) + (countMap.get(key('ME')) || 0);
  }

  if (department === 'B.COM(CA)') {
    return countMap.get(key('BCOM-CA')) || 0;
  }

  if (department === 'BCOM-CA') {
    return countMap.get(key('B.COM(CA)')) || 0;
  }

  return 0;
};

/**
 * Prefer a manually saved positive total; otherwise use live class headcount.
 * Schema default 0 must not block auto-fill from class/student details.
 */
export const resolveAllottedStudents = (saved, liveCount) => {
  const savedNum = Number(saved);
  if (Number.isFinite(savedNum) && savedNum > 0) return savedNum;
  return Number(liveCount) || 0;
};
