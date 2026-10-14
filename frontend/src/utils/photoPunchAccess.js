const PUNCH_ROLES = ['admin', 'trainer', 'subject_coordinator', 'evaluator'];

export const canUsePhotoPunch = (user) => PUNCH_ROLES.includes(user?.role);
export const PHOTO_PUNCH_ROLES = PUNCH_ROLES;
