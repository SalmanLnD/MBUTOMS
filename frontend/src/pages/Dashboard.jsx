import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import StatCard from '../components/StatCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { showError } from '../utils/toast.js';
import {
  TrainerIcon,
  StudentIcon,
  CalendarIcon,
  LeaveIcon,
  VenueIcon,
  ReplacementIcon,
} from '../components/icons.jsx';
import { getDashboardStats } from '../services/dashboardService.js';
import { getErrorMessage, formatDate } from '../utils/helpers.js';
import { formatTimeRange, formatScheduleClassLabel } from '../utils/scheduleUtils.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        showError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const { cards, attendanceSummary, trainerPerformance, upcomingClasses } = stats || {};

  const attendanceChartData = {
    labels: ['Present', 'Absent', 'Late', 'Leave', 'OD', 'Holiday'],
    datasets: [
      {
        data: [
          attendanceSummary?.present || 0,
          attendanceSummary?.absent || 0,
          attendanceSummary?.late || 0,
          attendanceSummary?.leave || 0,
          attendanceSummary?.od || 0,
          attendanceSummary?.holiday || 0,
        ],
        backgroundColor: ['#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#8b5cf6', '#64748b'],
      },
    ],
  };

  const performanceChartData = {
    labels: trainerPerformance?.map((t) => t.name) || [],
    datasets: [
      {
        label: 'Performance Score',
        data: trainerPerformance?.map((t) => t.performanceScore) || [],
        backgroundColor: 'rgba(20, 184, 166, 0.85)',
        hoverBackgroundColor: 'rgba(6, 182, 212, 0.95)',
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-4">
          <StatCard title="Total Trainers" value={cards?.totalTrainers} icon={<TrainerIcon size={24} />} accent="teal" />
        </div>
        <div className="col-6 col-xl-4">
          <StatCard title="Total Students" value={cards?.totalStudents} icon={<StudentIcon size={24} />} accent="violet" />
        </div>
        <div className="col-6 col-xl-4">
          <StatCard title="Today's Classes" value={cards?.todaysClasses} icon={<CalendarIcon size={24} />} accent="amber" />
        </div>
        <div className="col-6 col-xl-4">
          <StatCard title="Today's Leaves" value={cards?.todaysLeaves} icon={<LeaveIcon size={24} />} accent="rose" />
        </div>
        <div className="col-6 col-xl-4">
          <StatCard title="Active Venues" value={cards?.activeVenues} icon={<VenueIcon size={24} />} accent="cyan" />
        </div>
        <div className="col-6 col-xl-4">
          <StatCard title="Pending Replacements" value={cards?.pendingReplacements} icon={<ReplacementIcon size={24} />} accent="gold" />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card table-card h-100">
            <div className="card-body">
              <h5 className="card-title mb-3">Attendance Summary</h5>
              {attendanceChartData.datasets[0].data.some((v) => v > 0) ? (
                <Doughnut data={attendanceChartData} options={{ maintainAspectRatio: true }} />
              ) : (
                <p className="text-muted text-center py-5">
                  Attendance data will appear after Phase 3 implementation.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card table-card h-100">
            <div className="card-body">
              <h5 className="card-title mb-3">Top Trainer Performance</h5>
              {trainerPerformance?.length > 0 ? (
                <Bar
                  data={performanceChartData}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, max: 100 } },
                  }}
                />
              ) : (
                <p className="text-muted text-center py-5">No trainer performance data yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {upcomingClasses?.length > 0 && (
        <div className="card table-card mt-4">
          <div className="card-body">
            <h5 className="card-title mb-3">Upcoming Classes</h5>
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Class</th>
                    <th>Trainer</th>
                    <th>Venue</th>
                    <th>Dept / Section</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingClasses.map((cls) => (
                    <tr key={cls._id}>
                      <td>{cls.day}</td>
                      <td>{formatTimeRange(cls.startTime, cls.endTime)}</td>
                      <td>{formatScheduleClassLabel(cls)}</td>
                      <td>{cls.trainerCode}</td>
                      <td>—</td>
                      <td>{formatScheduleClassLabel(cls)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
