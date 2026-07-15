import { forceResetModalState, getOpenModalCount } from './modalManager.js';

/** Remove leftover Bootstrap modal artifacts only. Safe while TOMS modals are open. */
export const cleanupBootstrapArtifacts = () => {
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('padding-right');
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
};

/**
 * Clear body lock when no TOMS modal is tracked as open.
 * Does not remove React portal overlays — those unmount via React.
 */
export const cleanupModalArtifacts = () => {
  cleanupBootstrapArtifacts();

  if (getOpenModalCount() === 0) {
    document.body.style.removeProperty('overflow');
  }
};

/** Reset scroll lock / Bootstrap state. Safe during logout and route changes. */
export const resetAllModalArtifacts = () => {
  forceResetModalState();
};

/** Boot/HMR only: purge orphan overlays before React owns the tree. */
export const purgeModalOverlaysOnBoot = () => {
  forceResetModalState({ purgeOverlays: true });
};
