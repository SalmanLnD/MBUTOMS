import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll, unlockBodyScroll } from '../utils/modalManager.js';
import { cleanupBootstrapArtifacts } from '../utils/modalCleanup.js';

const Modal = ({
  show,
  onClose,
  title,
  children,
  footer,
  size = '',
  scrollable = false,
  dismissible = true,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!show) return undefined;

    lockBodyScroll();
    cleanupBootstrapArtifacts();

    const handleEscape = (e) => {
      if (e.key === 'Escape' && dismissible) onCloseRef.current?.();
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      unlockBodyScroll();
    };
  }, [show, dismissible]);

  if (!show) return null;

  const dialogClass = ['toms-modal-dialog', size, scrollable ? 'toms-modal-scrollable' : '']
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      className="toms-modal-overlay"
      onClick={() => {
        if (dismissible) onCloseRef.current?.();
      }}
      role="presentation"
    >
      <div
        className={dialogClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'toms-modal-title' : undefined}
      >
        <div className="toms-modal-content">
          {title && (
            <div className="toms-modal-header">
              <h5 className="toms-modal-title" id="toms-modal-title">{title}</h5>
              {dismissible && (
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => onCloseRef.current?.()}
                  aria-label="Close"
                />
              )}
            </div>
          )}
          {children}
          {footer && <div className="toms-modal-footer">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
