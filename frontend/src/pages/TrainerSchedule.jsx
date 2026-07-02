import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import TrainerTimetableGrid from '../components/TrainerTimetableGrid.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import { getTrainerById } from '../services/trainerService.js';
import { getTrainerSchedule } from '../services/scheduleService.js';
import { getErrorMessage, toInputDate } from '../utils/helpers.js';
import { formatTimeRange, formatScheduleClassLabel } from '../utils/scheduleUtils.js';

const TrainerSchedule = () => {
  const { id } = useParams();
  const [trainer, setTrainer] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('grid');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [trainerData, scheduleData] = await Promise.all([
        getTrainerById(id),
        getTrainerSchedule(id, { referenceDate: toInputDate(new Date()) }),
      ]);
      setTrainer(trainerData);
      setSchedules(scheduleData.schedules);
      setTotalHours(scheduleData.totalHours);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !trainer) return <LoadingSpinner message="Loading schedule..." />;

  return (
    <>
      <Topbar title="Trainer Schedule" />
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="mb-3">
        <Link to={`/trainers/${id}`} className="btn btn-link text-decoration-none ps-0">
          ← Back to Profile
        </Link>
      </div>

      {trainer && (
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card table-card h-100">
              <div className="card-body">
                <h5 className="card-title">{trainer.name}</h5>
                <p className="text-muted mb-0">{trainer.employeeId}</p>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card table-card h-100">
              <div className="card-body text-center">
                <p className="text-muted mb-1">Weekly Classes</p>
                <h3 className="mb-0">{schedules.length}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card table-card h-100">
              <div className="card-body text-center">
                <p className="text-muted mb-1">Hours / Week</p>
                <h3 className="mb-0">{totalHours.toFixed(1)} hrs</h3>
              </div>
            </div>
          </div>
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>
            Timetable
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
            List View
          </button>
        </li>
      </ul>

      {view === 'grid' ? (
        <TrainerTimetableGrid schedules={schedules} trainerCode={trainer?.employeeId} />
      ) : (
        <div className="card table-card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Class</th>
                    <th>Semester</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.length === 0 ? (
                    <tr><td colSpan="4" className="text-center text-muted py-4">No classes scheduled</td></tr>
                  ) : (
                    schedules.map((s) => (
                      <tr key={s._id}>
                        <td>{s.day}</td>
                        <td>{formatTimeRange(s.startTime, s.endTime)}</td>
                        <td>{formatScheduleClassLabel(s)}</td>
                        <td>{s.semester}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TrainerSchedule;
