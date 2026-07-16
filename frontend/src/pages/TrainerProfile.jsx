import { useParams, Link } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage.jsx';
import TrainerDetailsPanel from '../components/TrainerDetailsPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TrainerProfile = () => {
  const { id } = useParams();
  const { hasFullAccess } = useAuth();
  const canEdit = hasFullAccess();

  if (!id) return <AlertMessage message="Trainer not found" />;

  return (
    <>
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
