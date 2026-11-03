const LoadingSpinner = ({ message = 'Loading...', fullPage = false }) => {
  const content = (
    <div className="text-center py-5" role="status" aria-live="polite">
      <div className="spinner-border text-primary" aria-hidden="true" />
      {message && <p className="mt-2 text-muted">{message}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        {content}
      </div>
    );
  }
  return content;
};

export default LoadingSpinner;
