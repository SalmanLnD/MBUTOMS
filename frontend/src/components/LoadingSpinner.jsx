const LoadingSpinner = ({ message = 'Loading...', fullPage = false }) => {
  const content = (
    <div className="text-center py-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
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
