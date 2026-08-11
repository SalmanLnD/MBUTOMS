import { useState } from 'react';
import { FilterIcon, ChevronDownIcon } from './icons.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

const CollapsibleFilters = ({
  children,
  label = 'Filters',
  className = '',
  defaultOpen = false,
}) => {
  const isMobile = useMediaQuery('(max-width: 767.98px)');
  const [open, setOpen] = useState(defaultOpen);

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`toms-collapsible-filters ${open ? 'is-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="toms-collapsible-filters__toggle btn btn-sm btn-outline-secondary w-100 d-inline-flex align-items-center justify-content-between gap-2"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="d-inline-flex align-items-center gap-2">
          <FilterIcon size={16} />
          {label}
        </span>
        <ChevronDownIcon size={16} className="toms-collapsible-filters__chevron" />
      </button>
      {open && (
        <div className="toms-collapsible-filters__content">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleFilters;
