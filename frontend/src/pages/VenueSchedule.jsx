import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import ScheduleCalendar from '../components/ScheduleCalendar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import { getVenues } from '../services/venueService.js';
import { getVenueSchedule } from '../services/scheduleService.js';
import { formatDate, getErrorMessage } from '../utils/helpers.js';
import { formatTimeRange } from '../utils/scheduleUtils.js';

const VenueSchedule = () => {
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('calendar');

  useEffect(() => {
    const loadVenues = async () => {
      try {
        const data = await getVenues({ limit: 100, isActive: 'true' });
        setVenues(data.venues);
        if (data.venues.length > 0) setSelectedVenue(data.venues[0]._id);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    loadVenues();
  }, []);

  const fetchSchedule = useCallback(async (start, end) => {
    if (!selectedVenue) return;
    setLoading(true);
    try {
      const data = await getVenueSchedule(selectedVenue, start && end ? { start, end } : undefined);
      setSchedules(data.schedules);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedVenue]);

  useEffect(() => {
    if (selectedVenue) fetchSchedule();
  }, [selectedVenue, fetchSchedule]);

  const handleDatesSet = (info) => {
    fetchSchedule(info.start.toISOString(), info.end.toISOString());
  };

  const selectedVenueData = venues.find((v) => v._id === selectedVenue);

  return (
    <>
      <Topbar title="Venue Schedule" />
      <AlertMessage message={error} onClose={() => setError('')} />

      <div className="row g-3 mb-4 align-items-end">
        <div className="col-md-6">
          <label className="form-label">Select Venue</label>
          <select
            className="form-select"
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
          >
            {venues.map((v) => (
              <option key={v._id} value={v._id}>
                {v.name} — {v.building} (Cap: {v.capacity})
              </option>
            ))}
          </select>
        </div>
        {selectedVenueData && (
          <div className="col-md-6">
            <p className="text-muted mb-0">
              <strong>{selectedVenueData.name}</strong> · {selectedVenueData.building} · Floor {selectedVenueData.floor || 'N/A'} · {schedules.length} bookings in view
            </p>
          </div>
        )}
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
            Calendar View
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
            List View
          </button>
        </li>
      </ul>

      {loading && schedules.length === 0 ? (
        <LoadingSpinner message="Loading venue schedule..." />
      ) : view === 'calendar' ? (
        <ScheduleCalendar events={schedules} onDatesSet={handleDatesSet} />
      ) : (
        <div className="card table-card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Subject</th>
                    <th>Trainer</th>
                    <th>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.length === 0 ? (
                    <tr><td colSpan="5" className="text-center text-muted py-4">No bookings for this venue</td></tr>
                  ) : (
                    schedules.map((s) => (
                      <tr key={s._id}>
                        <td>{formatDate(s.date)} ({s.day})</td>
                        <td>{formatTimeRange(s.startTime, s.endTime)}</td>
                        <td>{s.subject?.name}</td>
                        <td>
                          <Link to={`/trainers/${s.trainer?._id}`}>{s.trainer?.name}</Link>
                        </td>
                        <td>{s.batch?.name}</td>
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

export default VenueSchedule;
