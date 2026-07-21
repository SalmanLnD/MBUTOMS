import { useMemo, useState } from 'react';
import {
  buildMonthOptions,
  clampMonthParts,
  formatMonthKey,
  formatMonthLabel,
  getCurrentMonthParts,
} from '../utils/monthDates.js';

const PlpTab = () => {
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [monthKey, setMonthKey] = useState(() => {
    const parts = clampMonthParts(getCurrentMonthParts());
    return formatMonthKey(parts.year, parts.month);
  });

  const selected = monthOptions.find((option) => option.value === monthKey)
    || { label: formatMonthLabel(...monthKey.split('-').map(Number)) };

  return (
    <>
      <ul className="nav nav-tabs mb-3 flex-wrap" role="tablist">
        {monthOptions.map((option) => (
          <li className="nav-item" key={option.value} role="presentation">
            <button
              type="button"
              role="tab"
              className={`nav-link ${monthKey === option.value ? 'active' : ''}`}
              aria-selected={monthKey === option.value}
              onClick={() => setMonthKey(option.value)}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="text-center text-muted py-5">
        <h2 className="h5 mb-2">Coming soon</h2>
        <p className="mb-0">
          PLP performance ratings for {selected.label} will appear here.
        </p>
      </div>
    </>
  );
};

export default PlpTab;
