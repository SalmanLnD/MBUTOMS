import { forceResetModalState, getOpenModalCount } from './modalManager.js';

/** Remove leftover Bootstrap modal artifacts only. Safe while TOMS modals are open. */
export const cleanupBootstrapArtifacts = () => {
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('padding-right');
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
};

/** Remove leftover modal artifacts when no custom modal is open. */
export const cleanupModalArtifacts = () => {
  cleanupBootstrapArtifacts();

  if (getOpenModalCount() === 0) {
    document.body.style.removeProperty('overflow');
    document.querySelectorAll('.toms-modal-overlay').forEach((el) => el.remove());
  }
};

/** Hard reset when navigation or recovery is needed. */
export const resetAllModalArtifacts = () => {
  forceResetModalState();
};
