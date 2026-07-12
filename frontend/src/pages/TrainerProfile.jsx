import { useParams, Link } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import TrainerDetailsPanel from '../components/TrainerDetailsPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TrainerProfile = () => {
  const { id } = useParams();
  const { hasManagementRole } = useAuth();
  const canEdit = hasManagementRole();

  if (!id) return <AlertMessage message="Trainer not found" />;

  return (
    <>
      <Topbar title="Trainer Profile" />

      <div className="mb-3">
        <Link to="/trainers" className="btn btn-link text-decoration-none ps-0">
          ← Back to Trainers
        </Link>
      </div>

      <TrainerDetailsPanel trainerId={id} canEdit={canEdit} />
    </>
  );
};

export default TrainerProfile;
