export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUBJECT_COORDINATOR: 'subject_coordinator',
  CAMPUS_MANAGER: 'campus_manager',
  TRAINER: 'trainer',
};

/** Staff with full app access (admin parity for manager). */
export const FULL_ACCESS_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.CAMPUS_MANAGER,
];

/** Staff who can manage day-to-day operations. */
export const MANAGEMENT_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBJECT_COORDINATOR,
  ROLES.CAMPUS_MANAGER,
];

/** Linked trainer accounts for these roles are hidden from attendance/timetable. */
export const ROSTER_HIDDEN_STAFF_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.CAMPUS_MANAGER,
];

export const IMPERSONATION_ROLES = FULL_ACCESS_ROLES;

export const IMPERSONATION_TARGET_ROLES = [
  ROLES.TRAINER,
  ROLES.SUBJECT_COORDINATOR,
];

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

export const isAuthorizedRole = (userRole, allowedRoles = []) => {
  if (!userRole || !allowedRoles.length) return false;
  return allowedRoles.some((allowed) => roleMatches(userRole, allowed));
};

export const canImpersonate = (userRole) => IMPERSONATION_ROLES.includes(userRole);
