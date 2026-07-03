import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { formatRole } from '../utils/helpers.js';

const Topbar = ({ title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar d-flex justify-content-between align-items-center mb-4">
      <h1 className="h4 mb-0 fw-semibold">{title}</h1>
      <div className="d-flex align-items-center gap-3">
        <span className="topbar-user small d-none d-md-inline">
          {user?.name} · {formatRole(user?.role)}
        </span>
        <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Topbar;
