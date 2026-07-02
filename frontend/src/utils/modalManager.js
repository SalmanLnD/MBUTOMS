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

export const forceResetModalState = () => {
  openModalCount = 0;
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
  document.body.classList.remove('modal-open');
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
  document.querySelectorAll('.toms-modal-overlay').forEach((el) => el.remove());
};
