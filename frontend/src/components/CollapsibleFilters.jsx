import { useState } from 'react';
import { FilterIcon, ChevronDownIcon } from './icons.jsx';

const CollapsibleFilters = ({
  children,
  label = 'Filters',
  className = '',
  defaultOpen = false,
  actions = null,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`toms-collapsible-filters ${open ? 'is-open' : ''} ${className}`.trim()}>
      <div className="toms-collapsible-filters__header">
      <button
        type="button"
        className="toms-collapsible-filters__toggle btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-between gap-2"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="d-inline-flex align-items-center gap-2">
          <FilterIcon size={16} aria-hidden="true" />
          {label}
        </span>
        <ChevronDownIcon aria-hidden="true" size={16} className="toms-collapsible-filters__chevron" />
      </button>
      {actions && <div className="toms-collapsible-filters__actions">{actions}</div>}
      </div>
      {open && (
        <div className="toms-collapsible-filters__content">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleFilters;
