import { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { getTimetableExecutionHours } from '../services/topicTrackerService.js';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const formatReportDate = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return '-';
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatHours = (value) => Number(value || 0).toFixed(2);
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const HoursTable = ({ columns, rows, totals, emptyLabel }) => (
  <div className="table-responsive">
    <table className="table table-hover align-middle mb-0">
      <thead className="table-light">
        <tr>
          {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          <th>Scheduled hours</th>
          <th>Cancelled hours</th>
          <th>Executed hours</th>
          <th>Awaiting completion</th>
          <th>Execution</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length + 5} className="text-center text-muted py-4">{emptyLabel}</td>
          </tr>
        ) : rows.map((row) => (
          <tr key={row.key}>
            {columns.map((column) => <td key={column.key}>{column.value(row)}</td>)}
            <td>{formatHours(row.scheduledHours)}</td>
            <td>{formatHours(row.cancelledHours)}</td>
            <td>{formatHours(row.executedHours)}</td>
            <td>{formatHours(row.pendingHours)}</td>
            <td>{formatPercent(row.executionPercent)}</td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="fw-semibold">
            <td colSpan={columns.length}>Total</td>
            <td>{formatHours(totals.scheduledHours)}</td>
            <td>{formatHours(totals.cancelledHours)}</td>
            <td>{formatHours(totals.executedHours)}</td>
            <td>{formatHours(totals.pendingHours)}</td>
            <td>{formatPercent(totals.executionPercent)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);

const TimetableExecutionTab = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getTimetableExecutionHours()
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((err) => {
        if (active) showError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingSpinner />;

  const totals = report?.totals || {};
  const subjects = (report?.subjects || []).map((row) => ({
    ...row,
    key: row.subjectId || row.subjectCode || row.subjectName,
  }));
  const classes = (report?.classes || []).map((row) => ({ ...row, key: row.classLabel }));

  return (
    <div>
      <p className="text-muted small mb-3">
        {formatReportDate(report?.from)} to {formatReportDate(report?.to)}.
        Scheduled hours are timetable hours with official holidays removed. Cancelled classes stay in scheduled hours.
        Executed hours use the scheduled duration of finished slots marked completed and closed in Topic Tracker. Other non-cancelled hours await completion.
      </p>

      <h5 className="mb-2">Subject wise</h5>
      <HoursTable
        columns={[
          { key: 'subject', label: 'Subject', value: (row) => row.subjectName },
          { key: 'code', label: 'Code', value: (row) => row.subjectCode || '-' },
        ]}
        rows={subjects}
        totals={totals}
        emptyLabel="No timetable hours in this period."
      />

      <h5 className="mt-4 mb-2">Class wise</h5>
      <HoursTable
        columns={[
          { key: 'class', label: 'Class', value: (row) => row.classLabel },
        ]}
        rows={classes}
        totals={totals}
        emptyLabel="No timetable hours in this period."
      />
    </div>
  );
};

export default TimetableExecutionTab;
