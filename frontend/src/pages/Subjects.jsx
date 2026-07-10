import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import SubjectFormModal from '../components/SubjectFormModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { getSubjects, deleteSubject } from '../services/subjectService.js';
import { EditIcon, TrashIcon } from '../components/icons.jsx';
import ActionIconButton from '../components/ActionIconButton.jsx';
import { getErrorMessage } from '../utils/helpers.js';

const formatSchools = (subject) => {
  if (subject.schools?.length) {
    return subject.schools.map((s) => s.code).join(', ');
  }
  if (subject.school?.code) return subject.school.code;
  return '-';
};

const formatDepartments = (subject) => {
  if (subject.allDepartments) return 'All Departments';
  if (subject.departments?.length) {
    return subject.departments.map((d) => d.code).join(', ');
  }
  if (subject.department?.code) return subject.department.code;
  return '-';
};

const Subjects = () => {
  const { hasManagementRole, hasFullAccess } = useAuth();
  const canManage = hasManagementRole();

  const [subjects, setSubjects] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const debouncedSearch = useDebounce(search);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const data = await getSubjects({ page, limit: 10, search: debouncedSearch });
      setSubjects(data.subjects);
      setPagination(data.pagination);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [page, debouncedSearch]);

  const handleDelete = async (id, name) => {
    setPendingDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSubject(pendingDelete.id);
      showSuccess('Subject deleted successfully');
      setPendingDelete(null);
      fetchSubjects();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Topbar title="Subject Management" />

      <div className="card table-card">
        <div className="card-body">
          <div className="row g-2 mb-3 align-items-center">
            <div className="col-md-6">
              <input
                type="search"
                className="form-control"
                placeholder="Search subjects..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            {canManage && (
              <div className="col-md-6 text-md-end">
                <button className="btn btn-primary" onClick={() => { setEditingSubject(null); setShowModal(true); }}>
                  + Add Subject
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
                      <th>Code</th>
                      <th>Name</th>
                      <th>School</th>
                      <th>Semester</th>
                      <th>Department</th>
                      <th>Hours</th>
                      {canManage && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.length === 0 ? (
                      <tr><td colSpan={canManage ? 7 : 6} className="text-center text-muted py-4">No subjects found</td></tr>
                    ) : (
                      subjects.map((subject) => (
                        <tr key={subject._id}>
                          <td><code>{subject.code}</code></td>
                          <td className="fw-medium">{subject.name}</td>
                          <td>{formatSchools(subject)}</td>
                          <td>{subject.semester?.name || '-'}</td>
                          <td>{formatDepartments(subject)}</td>
                          <td>{subject.hours}</td>
                          {canManage && (
                            <td>
                              <div className="btn-group btn-group-sm action-btn-group">
                                <ActionIconButton
                                  variant="edit"
                                  icon={EditIcon}
                                  title="Edit subject"
                                  aria-label={`Edit ${subject.name}`}
                                  onClick={() => { setEditingSubject(subject); setShowModal(true); }}
                                />
                                {hasFullAccess() && (
                                  <ActionIconButton
                                    variant="delete"
                                    icon={TrashIcon}
                                    title="Delete subject"
                                    aria-label={`Delete ${subject.name}`}
                                    onClick={() => handleDelete(subject._id, subject.name)}
                                  />
                                )}
                              </div>
                            </td>
                          )}
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

      {showModal && (
        <SubjectFormModal
          subject={editingSubject}
          onClose={(saved) => {
            setShowModal(false);
            setEditingSubject(null);
            if (saved) { showSuccess('Subject saved successfully'); fetchSubjects(); }
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          show
          title="Delete Subject"
          message={`Delete subject "${pendingDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default Subjects;
