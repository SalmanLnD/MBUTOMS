// Limited beta: Laxmi Priya, Navya Mallidi and Divya K; existing roles stay unchanged.
export const PHOTO_PUNCH_BETA_USER_IDS = ['6a508b8f7e83de4ee7da30e9', '6a508b8b7e83de4ee7da3096', '6a508b8d7e83de4ee7da30b9'];
export const canUsePhotoPunch = user => user?.role === 'admin' || PHOTO_PUNCH_BETA_USER_IDS.includes(String(user?._id || ''));
