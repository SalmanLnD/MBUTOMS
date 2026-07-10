import LoadingSpinner from './LoadingSpinner.jsx';

const formatAverage = (value) => (value != null ? `${value}/5` : '-');

const FeedbackSummaryTab = ({ summary, loading }) => {
  if (loading) return <LoadingSpinner />;

  const trainerSummaries = summary?.trainerSummaries || [];

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <div className="card h-100">
          <div className="card-body">
            <h6 className="text-muted text-uppercase small mb-2">Overall average</h6>
            <div className="display-6 fw-semibold">
              {formatAverage(summary?.overallAverage)}
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
              {formatAverage(summary?.currentMonth?.average)}
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
            <h6 className="mb-1">Trainer-wise summary</h6>
            <p className="text-muted small mb-3">
              All-time and {summary?.currentMonth?.label || 'current month'} averages per trainer.
            </p>
            {!trainerSummaries.length ? (
              <p className="text-muted mb-0">No trainers found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Trainer</th>
                      <th>Employee ID</th>
                      <th>Overall average</th>
                      <th>Overall responses</th>
                      <th>{summary?.currentMonth?.label || 'This month'}</th>
                      <th>Month responses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainerSummaries.map((trainer) => (
                      <tr key={trainer.trainerId}>
                        <td>
                          {trainer.name}
                          {trainer.status && trainer.status !== 'active' && (
                            <span className="badge bg-secondary ms-2 text-capitalize">{trainer.status}</span>
                          )}
                        </td>
                        <td><code>{trainer.employeeId || '-'}</code></td>
                        <td>{formatAverage(trainer.overallAverage)}</td>
                        <td>{trainer.overallCount}</td>
                        <td>{formatAverage(trainer.currentMonthAverage)}</td>
                        <td>{trainer.currentMonthCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
