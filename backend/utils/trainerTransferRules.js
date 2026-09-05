export const shouldRequirePermanentReplacement = ({ mode, hasAssignedClasses = false }) => {
  if (mode === 'replacement') return true;
  if (mode === 'resign' || mode === 'relocate' || mode === 'exit') {
    return Boolean(hasAssignedClasses);
  }
  return false;
};
