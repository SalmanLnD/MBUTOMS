import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
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
import { getErrorMessage } from '../utils/helpers.js';
import { useTheme } from '../context/ThemeContext.jsx';

ChartJS.register(CategoryScale, LinearScale, ArcElement, Title, Tooltip, Legend);

const Dashboard = () => {
  const { isDark } = useTheme();
  const chartText = isDark ? '#b3c4cf' : '#526570';
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

  const { cards, attendanceSummary } = stats || {};

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
        backgroundColor: ['#0d9488', '#e05272', '#f59e0b', '#6366f1', '#0284c7', '#a78bfa'],
      },
    ],
  };

  return (
    <div className="spatial-stack">
      <div className="bento-grid dashboard-stats">
        <div className="bento-cell bento-span-4">
          <StatCard title="Total Trainers" value={cards?.totalTrainers} icon={<TrainerIcon size={24} />} accent="teal" />
        </div>
        <div className="bento-cell bento-span-4">
          <StatCard title="Total Students" value={cards?.totalStudents} icon={<StudentIcon size={24} />} accent="violet" />
        </div>
        <div className="bento-cell bento-span-4">
          <StatCard title="Today's Classes" value={cards?.todaysClasses} icon={<CalendarIcon size={24} />} accent="amber" />
        </div>
        <div className="bento-cell bento-span-4">
          <StatCard title="Today's Leaves" value={cards?.todaysLeaves} icon={<LeaveIcon size={24} />} accent="rose" />
        </div>
        <div className="bento-cell bento-span-4">
          <StatCard title="Active Venues" value={cards?.activeVenues} icon={<VenueIcon size={24} />} accent="cyan" />
        </div>
        <div className="bento-cell bento-span-4">
          <StatCard title="Pending Replacements" value={cards?.pendingReplacements} icon={<ReplacementIcon size={24} />} accent="gold" />
        </div>
      </div>

      <div className="bento-grid">
        <div className="bento-cell bento-span-12">
          <div className="card table-card bento-panel h-100 clay-pressable">
            <div className="card-body">
              <h5 className="bento-panel__title">Attendance Summary</h5>
              {attendanceChartData.datasets[0].data.some((v) => v > 0) ? (
                <div className="dashboard-attendance-chart"><Doughnut data={attendanceChartData} options={{ maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: chartText, boxWidth: 12, padding: 16 } } } }} /></div>
              ) : (
                <p className="text-muted text-center py-5">
                  No attendance recorded for today.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
