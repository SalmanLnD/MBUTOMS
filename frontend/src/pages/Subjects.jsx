import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Pagination from '../components/Pagination.jsx';
import { showError, showSuccess } from '../utils/toast.js';
import SubjectFormModal from '../components/SubjectFormModal.jsx';
import SubjectResourceLinkModal from '../components/SubjectResourceLinkModal.jsx';
import SubjectTopicsModal from '../components/SubjectTopicsModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { usePagination } from '../hooks/usePagination.js';
import { getSubjects, deleteSubject, updateSubjectResources } from '../services/subjectService.js';
import { EditIcon, TrashIcon } from '../components/icons.jsx';
import ActionIconButton from '../components/ActionIconButton.jsx';
import { getErrorMessage } from '../utils/helpers.js';
import { ROLES } from '../utils/roles.js';
import { usePageTitle } from '../context/PageTitleContext.jsx';
import { isAbortError } from '../services/api.js';

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

const openExternalLink = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const Subjects = () => {
  const { user, hasRole, hasFullAccess } = useAuth();
  const canManage = hasFullAccess();
  usePageTitle(canManage ? 'Subject Management' : 'Subjects');
  const isSubjectCoordinator = hasRole(ROLES.SUBJECT_COORDINATOR);
  const showFullSubjectDetails = canManage || isSubjectCoordinator;
  const isTrainerUser = user?.role === ROLES.TRAINER;
  const {
    page,
    setPage,
    pageSize,
    changePageSize,
    resetPage,
    pagination,
    setPagination,
  } = usePagination({ initialPageSize: 10 });

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [resourceModal, setResourceModal] = useState(null);
  const [topicsModalOpen, setTopicsModalOpen] = useState(false);

  const debouncedSearch = useDebounce(search);

  const fetchSubjects = async (signal) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize, search: debouncedSearch };
      const data = await getSubjects(params, { signal });
      setSubjects(data.subjects);
      setPagination(data.pagination);
      setSelectedSubject((current) => {
        if (!current) return null;
        return data.subjects.find((subject) => subject._id === current._id) || null;
      });
    } catch (err) {
      if (isAbortError(err)) return;
      showError(getErrorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSubjects(controller.signal);
    return () => controller.abort();
  }, [page, pageSize, debouncedSearch]);

  const handleDelete = async (id, name) => {
    setPendingDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSubject(pendingDelete.id);
      showSuccess('Subject deleted successfully');
      if (selectedSubject?._id === pendingDelete.id) {
        setSelectedSubject(null);
      }
      setPendingDelete(null);
      fetchSubjects();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  const applySubjectUpdate = (updated) => {
    setSelectedSubject(updated);
    setEditingSubject((current) => (current?._id === updated._id ? updated : current));
    setSubjects((current) => current.map((subject) => (
      subject._id === updated._id ? updated : subject
    )));
  };

  const handleResourceSave = async (url) => {
    if (!resourceModal || !selectedSubject) return;
    const resourceFieldByType = {
      syllabus: 'syllabusUrl',
      cho: 'choUrl',
      practicePortal: 'practicePortalUrl',
    };
    const resourceLabelByType = {
      syllabus: 'Syllabus',
      cho: 'CHO',
      practicePortal: 'Practice Portal',
    };
    const field = resourceFieldByType[resourceModal.type];
    if (!field) return;

    const updated = await updateSubjectResources(selectedSubject._id, { [field]: url });
    applySubjectUpdate(updated);
    showSuccess(`${resourceLabelByType[resourceModal.type]} link saved`);
  };

  const handleRowSelect = (subject) => {
    setSelectedSubject(subject);
  };

  const handleEditSubject = (subject) => {
    setSelectedSubject(subject);
    setEditingSubject(subject);
    setShowModal(true);
  };

  const handleManageResource = (type, subject = selectedSubject) => {
    if (!subject) return;
    setSelectedSubject(subject);
    setResourceModal({ type });
  };

  const renderResourceButtons = () => {
    if (!selectedSubject) return null;

    const hasSyllabus = Boolean(selectedSubject.syllabusUrl?.trim());
    const hasCho = Boolean(selectedSubject.choUrl?.trim());
    const hasPracticePortal = Boolean(selectedSubject.practicePortalUrl?.trim());

    if (canManage) {
      return (
        <div>
          <h3 className="h6 fw-semibold mb-2">Resources</h3>
          <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setResourceModal({ type: 'syllabus' })}
          >
            {hasSyllabus ? 'Update Syllabus' : 'Add Syllabus'}
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setResourceModal({ type: 'cho' })}
          >
            {hasCho ? 'Update CHO' : 'Add CHO'}
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setResourceModal({ type: 'practicePortal' })}
          >
            {hasPracticePortal ? 'Update Practice Portal' : 'Add Practice Portal'}
          </button>
          {hasSyllabus && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openExternalLink(selectedSubject.syllabusUrl)}
            >
              Open Syllabus
            </button>
          )}
          {hasCho && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openExternalLink(selectedSubject.choUrl)}
            >
              Open CHO
            </button>
          )}
          {hasPracticePortal && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openExternalLink(selectedSubject.practicePortalUrl)}
            >
              Open Practice Portal
            </button>
          )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <h3 className="h6 fw-semibold mb-2">Resources</h3>
        <div className="d-flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!hasSyllabus}
          onClick={() => hasSyllabus && openExternalLink(selectedSubject.syllabusUrl)}
        >
          Syllabus
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!hasCho}
          onClick={() => hasCho && openExternalLink(selectedSubject.choUrl)}
        >
          CHO
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!hasPracticePortal}
          onClick={() => hasPracticePortal && openExternalLink(selectedSubject.practicePortalUrl)}
        >
          Practice Portal
        </button>
        </div>
      </div>
    );
  };

  const renderTopicsSection = () => {
    if (!selectedSubject || !canManage) return null;
    const topicCount = selectedSubject.topics?.length || 0;

    return (
      <div className="mt-4">
        <h3 className="h6 fw-semibold mb-2">Topic Tracker topics</h3>
        <p className="text-muted small mb-2">
          {topicCount
            ? `${topicCount} topic${topicCount === 1 ? '' : 's'} configured for the tracker dropdown.`
            : 'No topics configured yet — trainers can enter free text.'}
        </p>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => setTopicsModalOpen(true)}
        >
          {topicCount ? 'Manage topics' : 'Add topics'}
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="card table-card mb-3">
        <div className="card-body">
          <div className="row g-2 mb-3 align-items-center">
            <div className="col-md-6">
              <input
                type="search"
                className="form-control"
                placeholder="Search subjects..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
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
          <p className="text-muted small mb-3">
            {canManage
              ? 'Click a subject row to view details, or use Edit to manage syllabus, CHO, practice portal, and topic tracker topics.'
              : 'Click a subject row to view details and open syllabus, CHO, or practice portal links.'}
          </p>

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
                      {!isTrainerUser && (
                        <>
                          <th>School</th>
                          <th>Semester</th>
                          <th>Department</th>
                          <th>Hours</th>
                        </>
                      )}
                      {canManage && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isTrainerUser ? (canManage ? 3 : 2) : (canManage ? 7 : 6)}
                          className="text-center text-muted py-4"
                        >
                          No subjects found
                        </td>
                      </tr>
                    ) : (
                      subjects.map((subject) => {
                        const isSelected = selectedSubject?._id === subject._id;
                        return (
                          <tr
                            key={subject._id}
                            className={isSelected ? 'table-active' : ''}
                            onClick={() => handleRowSelect(subject)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td><code>{subject.code}</code></td>
                            <td className="fw-medium">{subject.name}</td>
                            {!isTrainerUser && (
                              <>
                                <td>{formatSchools(subject)}</td>
                                <td>{subject.semester?.name || '-'}</td>
                                <td>{formatDepartments(subject)}</td>
                                <td>{subject.hours}</td>
                              </>
                            )}
                            {canManage && (
                              <td onClick={(event) => event.stopPropagation()}>
                                <div className="btn-group btn-group-sm action-btn-group">
                                  <ActionIconButton
                                    variant="edit"
                                    icon={EditIcon}
                                    title="Edit subject"
                                    aria-label={`Edit ${subject.name}`}
                                    onClick={() => handleEditSubject(subject)}
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
                <Pagination
                  pagination={pagination}
                  onPageChange={setPage}
                  pageSize={pageSize}
                  onPageSizeChange={changePageSize}
                  showSummary
                  align="between"
                />
            </>
          )}
        </div>
      </div>

      {selectedSubject && (
        <div className="card table-card">
          <div className="card-body">
            <h2 className="h5 fw-semibold mb-3">{selectedSubject.name}</h2>
            <div className="row g-3 mb-3">
              <div className="col-sm-4">
                <label className="text-muted small">Subject Code</label>
                <p className="mb-0"><code>{selectedSubject.code}</code></p>
              </div>
              <div className="col-sm-4">
                <label className="text-muted small">Academic Year</label>
                <p className="mb-0">{selectedSubject.academicYear || '2026-27'}</p>
              </div>
              {showFullSubjectDetails && (
                <>
                  <div className="col-sm-4">
                    <label className="text-muted small">Semester</label>
                    <p className="mb-0">{selectedSubject.semester?.name || '-'}</p>
                  </div>
                  <div className="col-sm-4">
                    <label className="text-muted small">School</label>
                    <p className="mb-0">{formatSchools(selectedSubject)}</p>
                  </div>
                  <div className="col-sm-4">
                    <label className="text-muted small">Department</label>
                    <p className="mb-0">{formatDepartments(selectedSubject)}</p>
                  </div>
                  <div className="col-sm-4">
                    <label className="text-muted small">Hours</label>
                    <p className="mb-0">{selectedSubject.hours}</p>
                  </div>
                </>
              )}
            </div>
            {renderResourceButtons()}
            {renderTopicsSection()}
          </div>
        </div>
      )}

      {showModal && canManage && (
        <SubjectFormModal
          subject={editingSubject}
          onManageResource={(type) => handleManageResource(type, editingSubject)}
          onManageTopics={() => {
            if (editingSubject) {
              setSelectedSubject(editingSubject);
              setTopicsModalOpen(true);
            }
          }}
          onClose={(saved) => {
            setShowModal(false);
            setEditingSubject(null);
            if (saved) {
              showSuccess('Subject saved successfully');
              fetchSubjects();
            }
          }}
        />
      )}

      {resourceModal && selectedSubject && canManage && (
        <SubjectResourceLinkModal
          show
          title={
            resourceModal.type === 'syllabus'
              ? 'Add Syllabus Link'
              : resourceModal.type === 'cho'
                ? 'Add CHO Link'
                : 'Add Practice Portal Link'
          }
          initialUrl={
            resourceModal.type === 'syllabus'
              ? selectedSubject.syllabusUrl
              : resourceModal.type === 'cho'
                ? selectedSubject.choUrl
                : selectedSubject.practicePortalUrl
          }
          urlLabel={
            resourceModal.type === 'practicePortal'
              ? 'Practice portal URL'
              : 'Google Drive open link'
          }
          urlPlaceholder={
            resourceModal.type === 'practicePortal'
              ? 'https://www.hackerrank.com/...'
              : 'https://drive.google.com/...'
          }
          emptyError={
            resourceModal.type === 'practicePortal'
              ? 'Paste a practice portal URL.'
              : 'Paste a Google Drive open link.'
          }
          onClose={() => setResourceModal(null)}
          onSave={handleResourceSave}
        />
      )}

      {topicsModalOpen && selectedSubject && canManage && (
        <SubjectTopicsModal
          show
          subject={selectedSubject}
          onClose={() => setTopicsModalOpen(false)}
          onSaved={(updated) => {
            applySubjectUpdate(updated);
            showSuccess('Subject topics saved');
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
