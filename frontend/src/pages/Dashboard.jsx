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
import { getErrorMessage } from '../utils/helpers.js';
import { useTheme } from '../context/ThemeContext.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const formatRating = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}/5`;
};

const Dashboard = () => {
  const { isDark } = useTheme();
  const chartText = isDark ? '#b3c4cf' : '#526570';
  const chartLine = isDark ? '#334550' : '#dce3e8';
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

  const { cards, attendanceSummary, topTrainersByFeedback } = stats || {};

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
        backgroundColor: ['#23756d', '#aa4545', '#a87325', '#416a82', '#75849a', '#64748b'],
      },
    ],
  };

  const feedbackChartData = {
    labels: topTrainersByFeedback?.map((t) => t.name) || [],
    datasets: [
      {
        label: 'Average Feedback Rating',
        data: topTrainersByFeedback?.map((t) => t.averageRating) || [],
        backgroundColor: '#416a82',
        hoverBackgroundColor: '#275773',
        borderRadius: 3,
        borderSkipped: false,
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
        <div className="bento-cell bento-span-5">
          <div className="card table-card bento-panel h-100 clay-pressable">
            <div className="card-body">
              <h5 className="bento-panel__title">Attendance Summary</h5>
              {attendanceChartData.datasets[0].data.some((v) => v > 0) ? (
                <Doughnut data={attendanceChartData} options={{ maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: chartText, boxWidth: 12, padding: 16 } } } }} />
              ) : (
                <p className="text-muted text-center py-5">
                  No attendance recorded for today.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="bento-cell bento-span-7">
          <div className="card table-card bento-panel h-100 clay-pressable">
            <div className="card-body">
              <h5 className="bento-panel__title">Top Trainers by Feedback</h5>
              {topTrainersByFeedback?.length > 0 ? (
                <Bar
                  data={feedbackChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const trainer = topTrainersByFeedback[context.dataIndex];
                            const rating = formatRating(context.parsed.y);
                            const responses = trainer?.responseCount || 0;
                            return `${rating} (${responses} response${responses === 1 ? '' : 's'})`;
                          },
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                          stepSize: 1,
                          color: chartText,
                        },
                        grid: { color: chartLine },
                      },
                      x: { ticks: { color: chartText }, grid: { display: false } },
                    },
                  }}
                />
              ) : (
                <p className="text-muted text-center py-5">No feedback ratings yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
