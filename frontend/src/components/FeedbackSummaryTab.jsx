import LoadingSpinner from './LoadingSpinner.jsx';

const FeedbackSummaryTab = ({ summary, loading }) => {
  if (loading) return <LoadingSpinner />;

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <div className="card h-100">
          <div className="card-body">
            <h6 className="text-muted text-uppercase small mb-2">Overall average</h6>
            <div className="display-6 fw-semibold">
              {summary?.overallAverage != null ? `${summary.overallAverage}/5` : '-'}
            </div>
            <p className="text-muted mb-0">
              Based on {summary?.overallCount || 0} responses
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-6">
        <div className="card h-100">
          <div className="card-body">
            <h6 className="text-muted text-uppercase small mb-2">
              {summary?.currentMonth?.label || 'Current month'}
            </h6>
            <div className="display-6 fw-semibold">
              {summary?.currentMonth?.average != null ? `${summary.currentMonth.average}/5` : '-'}
            </div>
            <p className="text-muted mb-0">
              {summary?.currentMonth?.count || 0} responses this month
            </p>
          </div>
        </div>
      </div>
      <div className="col-12">
        <div className="card">
          <div className="card-body">
            <h6 className="mb-3">Recent published forms</h6>
            {!summary?.recentMonths?.length ? (
              <p className="text-muted mb-0">No published feedback forms yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Title</th>
                      <th>Published</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentMonths.map((item) => (
                      <tr key={item.monthKey}>
                        <td>{item.label}</td>
                        <td>{item.title}</td>
                        <td>{item.publishedAt ? new Date(item.publishedAt).toLocaleString('en-IN') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackSummaryTab;
