import { useEffect, useState } from 'react';
import api, { isAbortError } from '../services/api.js';
import Modal from './Modal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { useAcademicTerm } from '../context/AcademicTermContext.jsx';
import { termLabel } from '../utils/academicTerm.js';

const StudentMarksHistoryModal = ({ student, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const { enabled, viewedTerm } = useAcademicTerm() || {};
  useEffect(() => {
    const controller = new AbortController();
    api.get(`/student-test-reports/student/${student._id}/history`, { signal: controller.signal })
      .then(({ data: response }) => setData(response))
      .catch((err) => { if (!isAbortError(err)) setError(err.response?.data?.message || 'Unable to load marks history.'); });
    return () => controller.abort();
  }, [student._id]);

  return <Modal show title={`Marks history · ${student.name}`} onClose={onClose} size="modal-xl" scrollable>
    <div className="toms-modal-body">
      <p>{student.rollNumber}{enabled ? ` · ${termLabel(viewedTerm)}` : ''}. Saved marks retain their original subject and assessment-time department after a transfer.</p>
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : !data ? <LoadingSpinner message="Loading marks history..." /> : <div className="table-responsive">
        <table className="table align-middle"><thead><tr><th scope="col">Month</th><th scope="col">Subject</th><th scope="col">Department / section</th><th scope="col">Semester</th><th scope="col">Attendance</th><th scope="col">Marks</th><th scope="col">Remarks</th></tr></thead>
          <tbody>{data.reports?.length ? data.reports.map((report, index) => <tr key={report._id || index}>
            <td>{report.month}</td><td>{report.subjectName || report.subject?.name || 'Subject'}{report.subjectCode && <span className="d-block small text-muted">{report.subjectCode}</span>}</td>
            <td>{report.department} / {report.section}</td><td>{report.semester}</td><td>{report.attendance === 'A' ? 'Absent' : 'Present'}</td>
            <td>{report.attendance === 'A' ? 'Absent' : report.marksObtained == null ? 'Not graded' : `${report.marksObtained} / ${report.maxMarks}`}</td><td>{report.remarks || '—'}</td>
          </tr>) : <tr><td colSpan={7} className="text-muted text-center py-4">No saved test reports for this student in this semester.</td></tr>}</tbody>
        </table>
      </div>}
    </div>
  </Modal>;
};

export default StudentMarksHistoryModal;
