import { useId } from 'react';
import { DEFAULT_PAGE_SIZE_OPTIONS } from '../hooks/usePagination.js';
import '../styles/pagination.css';

/**
 * Shared list pagination controls.
 * Import on list pages and customize via props (pageSizeOptions, align, showSummary, className).
 */
const Pagination = ({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  align = 'center',
  showSummary = false,
  className = '',
  sizeLabel = 'Rows per page',
  previousLabel = 'Previous',
  nextLabel = 'Next',
}) => {
  const reactId = useId();
  const sizeSelectId = `pagination-page-size-${reactId}`;

  if (!pagination) return null;

  const { page, pages, total = 0, limit } = pagination;
  const showPageSize = typeof onPageSizeChange === 'function';
  const showPageNav = pages > 1;

  if (!showPageSize && !showPageNav && !showSummary) return null;

  const currentPageSize = pageSize ?? limit ?? pageSizeOptions[0];
  const options = pageSizeOptions.includes(currentPageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, currentPageSize].sort((a, b) => a - b);

  const pagesToShow = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let i = start; i <= end; i++) pagesToShow.push(i);

  const rangeStart = total === 0 ? 0 : (page - 1) * currentPageSize + 1;
  const rangeEnd = Math.min(page * currentPageSize, total);

  const alignClass =
    align === 'between' ? 'toms-pagination--between'
      : align === 'end' ? 'toms-pagination--end'
        : '';

  return (
    <nav
      aria-label="Page navigation"
      className={`toms-pagination ${alignClass} ${className}`.trim()}
    >
      {showSummary && (
        <p className="toms-pagination__summary">
          {total === 0
            ? 'No results'
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </p>
      )}

      {showPageNav && (
        <ul className="pagination toms-pagination__nav mb-0">
          <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              {previousLabel}
            </button>
          </li>
          {start > 1 && (
            <>
              <li className="page-item">
                <button type="button" className="page-link" onClick={() => onPageChange(1)}>
                  1
                </button>
              </li>
              {start > 2 && (
                <li className="page-item disabled">
                  <span className="page-link">...</span>
                </li>
              )}
            </>
          )}
          {pagesToShow.map((p) => (
            <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
              <button type="button" className="page-link" onClick={() => onPageChange(p)}>
                {p}
              </button>
            </li>
          ))}
          {end < pages && (
            <>
              {end < pages - 1 && (
                <li className="page-item disabled">
                  <span className="page-link">...</span>
                </li>
              )}
              <li className="page-item">
                <button type="button" className="page-link" onClick={() => onPageChange(pages)}>
                  {pages}
                </button>
              </li>
            </>
          )}
          <li className={`page-item ${page === pages ? 'disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              onClick={() => onPageChange(page + 1)}
              disabled={page === pages}
            >
              {nextLabel}
            </button>
          </li>
        </ul>
      )}

      {showPageSize && (
        <div className="toms-pagination__size">
          <label className="toms-pagination__size-label" htmlFor={sizeSelectId}>
            {sizeLabel}
          </label>
          <select
            id={sizeSelectId}
            className="form-select form-select-sm toms-pagination__size-select"
            value={currentPageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label={sizeLabel}
          >
            {options.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
};

export default Pagination;
