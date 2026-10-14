import { useCallback, useEffect, useRef, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import Pagination from './Pagination.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import Modal from './Modal.jsx';
import StyledSelect from './StyledSelect.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { usePagination } from '../hooks/usePagination.js';
import { fetchLatePunchPhoto, getLatePunches, reviewLatePunch } from '../services/attendanceService.js';
import { getErrorMessage } from '../utils/helpers.js';
import { buildMonthOptions, formatMonthKey, getCurrentMonthParts } from '../utils/monthDates.js';

const formatPunchTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDistance = (meters) => {
  if (meters == null) return '';
  if (meters < 1000) return `${meters} m from campus`;
  return `${(meters / 1000).toFixed(1)} km from campus`;
};

const sourceLabel = (source) => (source === 'toms_camera' ? 'TOMS punch' : 'WhatsApp');

const decisionLabel = {
  warning: 'Warning',
  misconduct: 'Late misconduct',
  dismissed: 'Not late',
};

const LatePunchPhoto = ({ item, onOpen }) => {
  const [src, setSrc] = useState(item.photoMode === 'url' ? item.photoUrl : '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (item.photoMode !== 'drive') return undefined;
    let active = true;
    let objectUrl = '';
    fetchLatePunchPhoto(item._id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item._id, item.photoMode]);

  if (!item.hasPhoto || failed) {
    return <div className="late-punch-photo late-punch-photo--empty">No photo saved</div>;
  }
  if (!src) {
    return <div className="late-punch-photo late-punch-photo--empty">Loading photo</div>;
  }
  return (
    <button type="button" className="late-punch-photo-button" aria-label="View punch photo" onClick={() => onOpen(src)}>
      <img src={src} alt="" className="late-punch-photo" />
    </button>
  );
};

const LateMisconductTab = () => {
  const {
    page,
    setPage,
    pageSize,
    changePageSize,
    resetPage,
    pagination,
    setPagination,
  } = usePagination({ initialPageSize: 20 });
  const [monthKey, setMonthKey] = useState(() => {
    const parts = getCurrentMonthParts();
    return formatMonthKey(parts.year, parts.month);
  });
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [openPhoto, setOpenPhoto] = useState('');
  const debouncedSearch = useDebounce(search);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLatePunches({
        month: monthKey,
        status,
        search: debouncedSearch,
        page,
        limit: pageSize,
      });
      setItems(data.items || []);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [monthKey, status, debouncedSearch, page, pageSize, setPagination]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const closeReview = useCallback(() => {
    if (!saving) setPendingAction(null);
  }, [saving]);

  const closePhoto = useCallback(() => setOpenPhoto(''), []);

  const handleConfirm = async () => {
    if (!pendingAction || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await reviewLatePunch(pendingAction.item._id, pendingAction.action);
      showSuccess(result.message || 'Review saved');
      setPendingAction(null);
      loadItems();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmCopy = () => {
    if (!pendingAction) return { title: '', message: '', label: 'Confirm', variant: 'primary' };
    const name = pendingAction.item.trainer?.name || 'this trainer';
    if (pendingAction.action === 'dismiss') {
      return {
        title: 'Leave as on time',
        message: `${name} will stay off the late-misconduct record. No warning or compliance point is added.`,
        label: 'Not late',
        variant: 'secondary',
      };
    }
    if (pendingAction.item.nextMarkOutcome === 'warning') {
      return {
        title: 'Record a warning',
        message: `This is the first late mark for ${name} in ${monthKey}. It is a warning only and does not add a compliance point.`,
        label: 'Save warning',
        variant: 'primary',
      };
    }
    return {
      title: 'Add late misconduct',
      message: `${name} already has a late mark this month. This one adds 1 compliance point on Performance.`,
      label: 'Add compliance',
      variant: 'danger',
    };
  };

  const copy = confirmCopy();

  return (
    <>
      <p className="text-muted small mb-3">
        WhatsApp and TOMS punches after 8:40 AM from 14 Oct 2026 onward are listed here. Use the photo and campus distance to decide.
        The first late mark for a trainer in a month is a warning. Each later mark adds 1 compliance point on Performance.
      </p>
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-md-3">
          <label className="form-label" htmlFor="late-month">Month</label>
          <StyledSelect
            id="late-month"
            value={monthKey}
            aria-label="Month"
            options={buildMonthOptions().filter((option) => option.value >= '2026-10')}
            onChange={(event) => {
              setMonthKey(event.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="late-status">Status</label>
          <StyledSelect
            id="late-status"
            value={status}
            aria-label="Status"
            options={[
              { value: 'pending', label: 'Needs review' },
              { value: 'reviewed', label: 'Reviewed' },
              { value: 'all', label: 'All' },
            ]}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="late-search">Trainer</label>
          <input
            id="late-search"
            type="search"
            className="form-control"
            placeholder="Name or employee ID"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />
        </div>
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <p className="text-muted mb-0">No punches after 8:40 AM in this view.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Trainer</th>
                <th>Punch</th>
                <th>Distance</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>
                    <LatePunchPhoto item={item} onOpen={setOpenPhoto} />
                  </td>
                  <td>
                    <div className="fw-semibold">{item.trainer?.name || 'Trainer'}</div>
                    <div className="small text-muted">{item.trainer?.employeeId || '-'}</div>
                  </td>
                  <td>
                    <div>{formatPunchTime(item.punchInAt)}</div>
                    <div className="small text-muted">
                      {sourceLabel(item.punchInSource)}
                      {item.oifNumber ? ` · ${item.oifNumber}` : ''}
                    </div>
                  </td>
                  <td>
                    {item.distance ? (
                      <>
                        <div>{formatDistance(item.distance.distanceMeters)}</div>
                        <div className="small text-muted">
                          {item.distance.onCampus ? 'Inside the campus area' : 'Outside the campus area'}
                          {item.distance.accuracyMeters != null ? ` · GPS ± ${item.distance.accuracyMeters} m` : ''}
                        </div>
                      </>
                    ) : (
                      <span className="small text-muted">No GPS on this punch. Decide from the time and photo.</span>
                    )}
                  </td>
                  <td>
                    {item.review ? (
                      <span className={`badge ${item.review.decision === 'misconduct' ? 'bg-danger' : item.review.decision === 'warning' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                        {decisionLabel[item.review.decision] || item.review.decision}
                      </span>
                    ) : (
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => setPendingAction({ item, action: 'mark' })}
                        >
                          {item.nextMarkOutcome === 'warning' ? 'Mark warning' : 'Mark misconduct'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setPendingAction({ item, action: 'dismiss' })}
                        >
                          Not late
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={changePageSize}
      />

      {pendingAction && (
        <ConfirmModal
          show
          title={copy.title}
          message={copy.message}
          confirmLabel={saving ? 'Saving...' : copy.label}
          confirmVariant={copy.variant}
          onConfirm={handleConfirm}
          onClose={closeReview}
        />
      )}

      {openPhoto && (
        <Modal show title="Punch photo" onClose={closePhoto} size="toms-modal-lg">
          <img src={openPhoto} alt="Punch photo" className="img-fluid d-block mx-auto" />
        </Modal>
      )}

      <style>{`
        .late-punch-photo {
          width: 72px;
          height: 96px;
          object-fit: cover;
          border-radius: 6px;
          background: #f3f4f6;
        }
        .late-punch-photo--empty {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          font-size: 11px;
          color: #6b7280;
          text-align: center;
        }
        .late-punch-photo-button {
          border: 0;
          padding: 0;
          background: transparent;
        }
      `}</style>
    </>
  );
};

export default LateMisconductTab;
