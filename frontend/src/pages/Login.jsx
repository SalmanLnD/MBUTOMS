import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ResetPasswordModal from '../components/ResetPasswordModal.jsx';
import { showError } from '../utils/toast.js';
import { getErrorMessage } from '../utils/helpers.js';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const { login, completePasswordReset } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.requiresPasswordReset || data.mustResetPassword) {
        setShowResetModal(true);
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetComplete = (data) => {
    completePasswordReset(data);
    setShowResetModal(false);
    navigate('/dashboard');
  };

  return (
    <>
      <div className="login-page">
        <div className="card login-card">
          <div className="card-body p-4 p-md-5">
            <div className="text-center mb-4">
              <div className="login-brand-icon mb-3">T</div>
              <h2 className="fw-bold">TOMS</h2>
              <p className="text-muted">Training Operations Management System</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  type="email"
                  id="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trainer@example.com"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  type="password"
                  id="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password or initial OTP"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {showResetModal && (
        <ResetPasswordModal show onComplete={handlePasswordResetComplete} />
      )}
    </>
  );
};

export default Login;
