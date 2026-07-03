const StatCard = ({ title, value, icon, subtitle, accent = 'teal' }) => (
  <div className={`card stat-card stat-card--${accent} h-100`}>
    <div className="card-body d-flex align-items-center gap-3">
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="text-muted mb-0 small">{title}</p>
        <h3 className="mb-0 fw-bold">{value ?? 0}</h3>
        {subtitle && <small className="text-muted">{subtitle}</small>}
      </div>
    </div>
  </div>
);

export default StatCard;
