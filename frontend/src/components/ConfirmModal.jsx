import Modal from './Modal.jsx';

const ConfirmModal = ({
  show,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  return (
    <Modal
      show
      title={title}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn btn-${confirmVariant}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      )}
    >
      <div className="toms-modal-body">
        <p className="mb-0">{message}</p>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
