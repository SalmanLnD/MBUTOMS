import { useState, useEffect, useCallback } from 'react';
import { createContext, useContext } from 'react';
import {
  login as loginApi,
  getMe,
  resetPassword as resetPasswordApi,
  getImpersonationTargets as getImpersonationTargetsApi,
  impersonateUser as impersonateUserApi,
  stopImpersonation as stopImpersonationApi,
} from '../services/authService.js';
import {
  FULL_ACCESS_ROLES,
  MANAGEMENT_ROLES,
  matchesRole,
  canImpersonate,
} from '../utils/roles.js';
import { resolveLinkedTrainerId } from '../utils/helpers.js';

const AuthContext = createContext(null);

const buildUserData = (data) => ({
  _id: data._id,
  name: data.name,
  email: data.email,
  role: data.role,
  trainer: resolveLinkedTrainerId(data.trainer),
  mustResetPassword: Boolean(data.mustResetPassword),
  requiresPasswordReset: Boolean(data.requiresPasswordReset || data.mustResetPassword),
  impersonating: Boolean(data.impersonating),
  impersonator: data.impersonator || null,
});

const storeUser = (userData, token) => {
  if (token) localStorage.setItem('toms_token', token);
  localStorage.setItem('toms_user', JSON.stringify(userData));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('toms_user');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      trainer: resolveLinkedTrainerId(parsed.trainer),
    };
  });
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data) => {
    const userData = buildUserData(data);
    storeUser(userData, data.token);
    setUser(userData);
    return userData;
  }, []);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('toms_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const userData = await getMe();
      applySession({ ...userData, token });
    } catch {
      localStorage.removeItem('toms_token');
      localStorage.removeItem('toms_user');
      localStorage.removeItem('toms_admin_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const data = await loginApi({ email, password });
    applySession(data);
    return data;
  };

  const completePasswordReset = (data) => {
    applySession({
      ...data,
      mustResetPassword: false,
      requiresPasswordReset: false,
    });
  };

  const logout = () => {
    localStorage.removeItem('toms_token');
    localStorage.removeItem('toms_user');
    localStorage.removeItem('toms_admin_token');
    setUser(null);
  };

  const hasRole = (...roles) => matchesRole(user?.role, roles);

  const hasManagementRole = () => matchesRole(user?.role, MANAGEMENT_ROLES);

  const hasFullAccess = () => matchesRole(user?.role, FULL_ACCESS_ROLES);

  const canImpersonateUsers = () => {
    const staffRole = user?.impersonating ? user?.impersonator?.role : user?.role;
    return canImpersonate(staffRole) && !user?.impersonating;
  };

  const startImpersonation = async (targetUserId) => {
    const currentToken = localStorage.getItem('toms_token');
    const data = await impersonateUserApi(targetUserId);
    if (currentToken && !localStorage.getItem('toms_admin_token')) {
      localStorage.setItem('toms_admin_token', currentToken);
    }
    applySession(data);
    return data;
  };

  const stopImpersonation = async () => {
    const data = await stopImpersonationApi();
    localStorage.removeItem('toms_admin_token');
    applySession(data);
    return data;
  };

  const fetchImpersonationTargets = async () => {
    const data = await getImpersonationTargetsApi();
    return data.targets || [];
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      hasRole,
      hasManagementRole,
      hasFullAccess,
      canImpersonateUsers,
      startImpersonation,
      stopImpersonation,
      fetchImpersonationTargets,
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
