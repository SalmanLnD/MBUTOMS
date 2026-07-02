import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AlertMessage from '../components/AlertMessage.jsx';
import { getErrorMessage } from '../utils/helpers.js';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div
              className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 56, height: 56, fontSize: '1.5rem', fontWeight: 700 }}
            >
              T
            </div>
            <h2 className="fw-bold">TOMS</h2>
            <p className="text-muted">Training Operations Management System</p>
          </div>

          <AlertMessage message={error} onClose={() => setError('')} />

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                type="email"
                id="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@toms.edu"
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
                placeholder="Enter password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-light rounded small text-muted">
            <strong>Demo accounts:</strong>
            <ul className="mb-0 mt-1">
              <li>admin@toms.edu / admin123</li>
              <li>manager@toms.edu / manager123</li>
              <li>trainer@toms.edu / trainer123</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
