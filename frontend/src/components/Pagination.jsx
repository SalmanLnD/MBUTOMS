const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

const Pagination = ({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}) => {
  if (!pagination) return null;

  const { page, pages } = pagination;
  const showPageSize = typeof onPageSizeChange === 'function';
  const showPageNav = pages > 1;

  if (!showPageSize && !showPageNav) return null;

  const currentPageSize = pageSize ?? pagination.limit ?? pageSizeOptions[0];
  const options = pageSizeOptions.includes(currentPageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, currentPageSize].sort((a, b) => a - b);

  const pagesToShow = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let i = start; i <= end; i++) pagesToShow.push(i);

  return (
    <nav
      aria-label="Page navigation"
      className="mt-3 d-flex flex-wrap align-items-center justify-content-center gap-3"
    >
      {showPageNav && (
        <ul className="pagination mb-0">
          <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
              Previous
            </button>
          </li>
          {start > 1 && (
            <>
              <li className="page-item">
                <button className="page-link" onClick={() => onPageChange(1)}>1</button>
              </li>
              {start > 2 && <li className="page-item disabled"><span className="page-link">...</span></li>}
            </>
          )}
          {pagesToShow.map((p) => (
            <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
              <button className="page-link" onClick={() => onPageChange(p)}>{p}</button>
            </li>
          ))}
          {end < pages && (
            <>
              {end < pages - 1 && <li className="page-item disabled"><span className="page-link">...</span></li>}
              <li className="page-item">
                <button className="page-link" onClick={() => onPageChange(pages)}>{pages}</button>
              </li>
            </>
          )}
          <li className={`page-item ${page === pages ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => onPageChange(page + 1)} disabled={page === pages}>
              Next
            </button>
          </li>
        </ul>
      )}

      {showPageSize && (
        <div className="d-flex align-items-center gap-2">
          <label className="form-label mb-0 small text-muted" htmlFor="pagination-page-size">
            Rows per page
          </label>
          <select
            id="pagination-page-size"
            className="form-select form-select-sm w-auto"
            value={currentPageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
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
