let openModalCount = 0;

export const getOpenModalCount = () => openModalCount;

export const lockBodyScroll = () => {
  openModalCount += 1;
  if (openModalCount === 1) {
    document.body.style.overflow = 'hidden';
  }
};

export const unlockBodyScroll = () => {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    document.body.classList.remove('modal-open');
  }
};

/**
 * Reset body scroll / Bootstrap leftovers.
 * Do not remove `.toms-modal-overlay` while React may still own those portals —
 * ripping them out causes NotFoundError: removeChild on logout/navigation.
 * Pass purgeOverlays only before React mounts (app boot / cold start).
 */
export const forceResetModalState = ({ purgeOverlays = false } = {}) => {
  openModalCount = 0;
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
  document.body.classList.remove('modal-open');
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
  if (purgeOverlays) {
    document.querySelectorAll('.toms-modal-overlay').forEach((el) => el.remove());
  }
};
