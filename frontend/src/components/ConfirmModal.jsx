import Modal from './Modal.jsx';
import AsyncButton from './AsyncButton.jsx';

const ConfirmModal = ({
  show,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onClose,
  children,
}) => {
  if (!show) return null;

  return (
    <Modal
      show
      title={title}
      onClose={onClose}
      footer={(
        <>
          <AsyncButton type="button" className="btn btn-secondary" onClick={onClose}>
            {cancelLabel}
          </AsyncButton>
          <AsyncButton type="button" className={`btn btn-${confirmVariant}`} onClick={onConfirm}>
            {confirmLabel}
          </AsyncButton>
        </>
      )}
    >
      <div className="toms-modal-body">
        {message && <p className="mb-0">{message}</p>}
        {children}
      </div>
    </Modal>
  );
};

export default ConfirmModal;
