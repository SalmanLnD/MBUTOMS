const ActionCount = ({ count, className = '' }) => {
  const value = Number(count) || 0;
  if (value <= 0) return null;
  const label = value > 99 ? '99+' : String(value);
  return (
    <span className={`action-count ${className}`.trim()} aria-label={`${value} pending`}>
      {label}
    </span>
  );
};

export default ActionCount;
