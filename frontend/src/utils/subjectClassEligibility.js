export const subjectHasClassRestrictions = (subject) => {
  if (!subject) return false;
  if (subject.allDepartments) return Boolean((subject.schools || []).length);
  return Boolean((subject.departments || []).length);
};
