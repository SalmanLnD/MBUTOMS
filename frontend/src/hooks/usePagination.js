import { useState } from 'react';

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

/**
 * Shared page / page-size state for list screens.
 * Customize per page via initialPageSize and pageSizeOptions.
 */
export const usePagination = ({
  initialPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
} = {}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [pagination, setPagination] = useState(null);

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  const resetPage = () => setPage(1);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    changePageSize,
    resetPage,
    pagination,
    setPagination,
    pageSizeOptions,
  };
};
