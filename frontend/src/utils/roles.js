export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUBJECT_COORDINATOR: 'subject_coordinator',
  CAMPUS_MANAGER: 'campus_manager',
  TRAINER: 'trainer',
};

export const FULL_ACCESS_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.CAMPUS_MANAGER,
];

export const MANAGEMENT_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBJECT_COORDINATOR,
  ROLES.CAMPUS_MANAGER,
];

/** Roles that apply leave for themselves only (linked trainer record). */
export const TRAINER_LIKE_ROLES = [ROLES.TRAINER, ROLES.SUBJECT_COORDINATOR];

export const IMPERSONATION_ROLES = FULL_ACCESS_ROLES;

const roleMatches = (userRole, allowedRole) => {
  if (userRole === allowedRole) return true;
  if (
    (userRole === ROLES.MANAGER || userRole === ROLES.CAMPUS_MANAGER)
    && (allowedRole === ROLES.MANAGER || allowedRole === ROLES.CAMPUS_MANAGER)
  ) {
    return true;
  }
  if (userRole === ROLES.SUBJECT_COORDINATOR && allowedRole === ROLES.CAMPUS_MANAGER) {
    return true;
  }
  if (allowedRole === ROLES.SUBJECT_COORDINATOR && userRole === ROLES.CAMPUS_MANAGER) {
    return true;
  }
  return false;
};

export const matchesRole = (userRole, allowedRoles = []) => {
  if (!userRole || !allowedRoles.length) return false;
  return allowedRoles.some((allowed) => roleMatches(userRole, allowed));
};

export const isTrainerLikeRole = (userRole) => TRAINER_LIKE_ROLES.includes(userRole);

/** Only admins may create leave requests on behalf of other trainers. */
export const canCreateLeaveForOthers = (userRole) => userRole === ROLES.ADMIN;

export const canImpersonate = (userRole) => IMPERSONATION_ROLES.includes(userRole);

export const needsPasswordReset = (user) =>
  Boolean(user?.mustResetPassword || user?.requiresPasswordReset);
