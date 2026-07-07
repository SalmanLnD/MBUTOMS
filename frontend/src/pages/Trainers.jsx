import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import TrainerFormModal from '../components/TrainerFormModal.jsx';
import TrainerAttendanceTab from '../components/TrainerAttendanceTab.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { getTrainers, deleteTrainer } from '../services/trainerService.js';
import { getErrorMessage } from '../utils/helpers.js';

const Trainers = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin', 'campus_manager');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'attendance' ? 'attendance' : 'directory';

  const [trainers, setTrainers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [sortBy, setSortBy] = useState('employeeId');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debouncedSearch = useDebounce(search);
  const debouncedSubjectSearch = useDebounce(subjectSearch);

  const fetchTrainers = async () => {
    setLoading(true);
    try {
      const data = await getTrainers({
        page,
        limit: 10,
        search: debouncedSearch,
        subject: debouncedSubjectSearch,
        sortBy,
        sortOrder,
      });
      setTrainers(data.trainers);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'directory') {
      fetchTrainers();
    }
  }, [activeTab, page, debouncedSearch, debouncedSubjectSearch, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleDelete = async (id, name) => {
    setPendingDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTrainer(pendingDelete.id);
      showSuccess('Trainer deleted successfully');
      setPendingDelete(null);
      fetchTrainers();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const handleEdit = (trainer) => {
    setEditingTrainer(trainer);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingTrainer(null);
    setShowModal(true);
  };

  const handleModalClose = (saved) => {
    setShowModal(false);
    setEditingTrainer(null);
    if (saved) {
      showSuccess(saved === true ? 'Trainer saved successfully' : saved);
      fetchTrainers();
    }
  };

  const setTab = (tab) => {
    if (tab === 'directory') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: 'attendance' });
    }
  };

  const sortIcon = (field) => (sortBy === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <>
      <Topbar title="Trainer Management" />

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => setTab('directory')}
          >
            Directory
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setTab('attendance')}
          >
            Attendance
          </button>
        </li>
      </ul>

      {activeTab === 'attendance' ? (
        <div className="card table-card">
          <div className="card-body">
            <TrainerAttendanceTab />
          </div>
        </div>
      ) : (
        <div className="card table-card">
          <div className="card-body">
            <div className="row g-2 mb-3 align-items-center">
              <div className="col-md-4">
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search trainers..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  aria-label="Search trainers"
                />
              </div>
              <div className="col-md-4">
                <input
                  type="search"
                  className="form-control"
                  placeholder="Filter by subject name or code..."
                  value={subjectSearch}
                  onChange={(e) => { setSubjectSearch(e.target.value); setPage(1); }}
                  aria-label="Filter trainers by subject"
                />
              </div>
              {canManage && (
                <div className="col-md-4 text-md-end">
                  <button type="button" className="btn btn-primary" onClick={handleAdd}>
                    + Add Trainer
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th role="button" onClick={() => handleSort('employeeId')}>
                          Employee ID{sortIcon('employeeId')}
                        </th>
                        <th role="button" onClick={() => handleSort('name')}>
                          Name{sortIcon('name')}
                        </th>
                        <th>Subjects</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainers.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-4">
                            No trainers found
                          </td>
                        </tr>
                      ) : (
                        trainers.map((trainer) => (
                          <tr key={trainer._id}>
                            <td><code>{trainer.employeeId}</code></td>
                            <td>
                              <Link to={`/trainers/${trainer._id}`} className="text-decoration-none fw-medium">
                                {trainer.name}
                              </Link>
                            </td>
                            <td>
                              {trainer.subjects?.length > 0
                                ? trainer.subjects.map((s) => s.code).join(', ')
                                : '-'}
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm">
                                <Link to={`/trainers/${trainer._id}`} className="btn btn-outline-primary">
                                  View
                                </Link>
                                {canManage && (
                                  <>
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => handleEdit(trainer)}>
                                      Edit
                                    </button>
                                    {hasRole('admin') && (
                                      <button
                                        type="button"
                                        className="btn btn-outline-danger"
                                        onClick={() => handleDelete(trainer._id, trainer.name)}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={pagination} onPageChange={setPage} />
              </>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <TrainerFormModal trainer={editingTrainer} onClose={handleModalClose} />
      )}

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Trainer"
          message={`Delete trainer "${pendingDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default Trainers;
