import { useEffect, useId, useRef } from 'react';
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
  className = '',
}) => {
  const titleId = useId();
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!show) return undefined;

    lockBodyScroll();
    cleanupBootstrapArtifacts();
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.focus();
    const viewport = window.visualViewport;
    const fitVisibleViewport = () => {
      if (!viewport || !overlayRef.current) return;
      Object.assign(overlayRef.current.style, {
        top: `${viewport.offsetTop}px`, left: `${viewport.offsetLeft}px`,
        width: `${viewport.width}px`, height: `${viewport.height}px`,
        right: 'auto', bottom: 'auto',
      });
      overlayRef.current.style.setProperty('--dialog-viewport-height', `${viewport.height}px`);
    };
    fitVisibleViewport();
    viewport?.addEventListener('resize', fitVisibleViewport);
    viewport?.addEventListener('scroll', fitVisibleViewport);

    const handleEscape = (e) => {
      if (dialog !== [...document.querySelectorAll('.toms-modal-dialog')].at(-1)) return;
      if (e.key === 'Escape' && dismissible) {
        // Let a dropdown handle Escape first when it owns the focus.
        if (document.querySelector('.toms-styled-select__menu, .toms-styled-multi-select__menu')) return;
        onCloseRef.current?.();
      }
      if (e.key !== 'Tab' || !dialog) return;
      // Dropdowns render in portals and manage their own keyboard navigation.
      if (!dialog.contains(document.activeElement)) return;
      const focusable = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
        .filter((element) => element.getClientRects().length && element.getAttribute('aria-hidden') !== 'true');
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      viewport?.removeEventListener('resize', fitVisibleViewport);
      viewport?.removeEventListener('scroll', fitVisibleViewport);
      unlockBodyScroll();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [show, dismissible]);

  if (!show) return null;

  const dialogClass = ['toms-modal-dialog', size, scrollable ? 'toms-modal-scrollable' : '', className]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      className="toms-modal-overlay"
      ref={overlayRef}
      onClick={() => {
        if (dismissible) onCloseRef.current?.();
      }}
      role="presentation"
    >
      <div
        className={dialogClass}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <div className="toms-modal-content">
          {title && (
            <div className="toms-modal-header">
              <h5 className="toms-modal-title" id={titleId}>{title}</h5>
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
