import { useState, useEffect, useCallback } from 'react';
import { createContext, useContext } from 'react';
import { login as loginApi, getMe, resetPassword as resetPasswordApi } from '../services/authService.js';

const AuthContext = createContext(null);

const storeUser = (userData, token) => {
  if (token) localStorage.setItem('toms_token', token);
  localStorage.setItem('toms_user', JSON.stringify(userData));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('toms_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('toms_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const userData = await getMe();
      setUser(userData);
      localStorage.setItem('toms_user', JSON.stringify(userData));
    } catch {
      localStorage.removeItem('toms_token');
      localStorage.removeItem('toms_user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const data = await loginApi({ email, password });
    const userData = {
      _id: data._id,
      name: data.name,
      email: data.email,
      role: data.role,
      trainer: data.trainer,
      mustResetPassword: data.mustResetPassword,
      requiresPasswordReset: data.requiresPasswordReset,
    };
    storeUser(userData, data.token);
    setUser(userData);
    return data;
  };

  const completePasswordReset = (data) => {
    const userData = {
      _id: data._id,
      name: data.name,
      email: data.email,
      role: data.role,
      trainer: data.trainer,
      mustResetPassword: false,
      requiresPasswordReset: false,
    };
    storeUser(userData, data.token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('toms_token');
    localStorage.removeItem('toms_user');
    setUser(null);
  };

  const hasRole = (...roles) => roles.includes(user?.role);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      hasRole,
      completePasswordReset,
      resetPasswordApi,
    }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
