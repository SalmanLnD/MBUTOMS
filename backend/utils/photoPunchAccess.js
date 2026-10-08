// Limited beta: Thanneru Laxmi Priya, without changing her trainer role.
export const PHOTO_PUNCH_BETA_USER_IDS = ['6a508b8f7e83de4ee7da30e9'];
export const canUsePhotoPunch = user => user?.role === 'admin' || PHOTO_PUNCH_BETA_USER_IDS.includes(String(user?._id || ''));
