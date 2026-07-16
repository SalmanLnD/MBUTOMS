import { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  notifySessionExpired,
  resetSessionExpiredState,
} from '../utils/sessionManager.js';
import { resetAllModalArtifacts } from '../utils/modalCleanup.js';

const AuthContext = createContext(null);

const buildUserData = (data) => ({
  _id: data._id,
  name: data.name,
  email: data.email,
  role: data.role,
  trainer: resolveLinkedTrainerId(data.trainer),
  coordinatorSubjects: data.coordinatorSubjects || [],
  sessionVersion: data.sessionVersion ?? 1,
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
    resetSessionExpiredState();
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

  useEffect(() => {
    if (!user) return undefined;

    const validateSession = async () => {
      try {
        const fresh = await getMe();
        const freshVersion = fresh.sessionVersion ?? 1;
        const cachedVersion = user.sessionVersion ?? 1;
        if (freshVersion !== cachedVersion || fresh.role !== user.role) {
          notifySessionExpired({
            code: 'SESSION_EXPIRED',
            message: 'Your session has expired. Please sign in again to continue with your updated access.',
          });
        }
      } catch {
        // Handled by the API interceptor when a stored token is invalid.
      }
    };

    const onFocus = () => {
      validateSession();
    };

    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(validateSession, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [user]);

  const login = useCallback(async (email, password) => {
    const data = await loginApi({ email, password });
    applySession(data);
    return data;
  }, [applySession]);

  const completePasswordReset = useCallback((data) => {
    applySession({
      ...data,
      mustResetPassword: false,
      requiresPasswordReset: false,
    });
  }, [applySession]);

  const logout = useCallback(() => {
    resetAllModalArtifacts();
    resetSessionExpiredState();
    localStorage.removeItem('toms_token');
    localStorage.removeItem('toms_user');
    localStorage.removeItem('toms_admin_token');
    setUser(null);
  }, []);

  const userRole = user?.role;
  const isImpersonating = Boolean(user?.impersonating);
  const impersonatorRole = user?.impersonator?.role;

  const hasRole = useCallback(
    (...roles) => matchesRole(userRole, roles),
    [userRole]
  );

  const hasManagementRole = useCallback(
    () => matchesRole(userRole, MANAGEMENT_ROLES),
    [userRole]
  );

  const hasFullAccess = useCallback(
    () => matchesRole(userRole, FULL_ACCESS_ROLES),
    [userRole]
  );

  const canImpersonateUsers = useCallback(() => {
    const staffRole = isImpersonating ? impersonatorRole : userRole;
    return canImpersonate(staffRole) && !isImpersonating;
  }, [isImpersonating, impersonatorRole, userRole]);

  const startImpersonation = useCallback(async (targetUserId) => {
    const currentToken = localStorage.getItem('toms_token');
    const data = await impersonateUserApi(targetUserId);
    if (currentToken && !localStorage.getItem('toms_admin_token')) {
      localStorage.setItem('toms_admin_token', currentToken);
    }
    applySession(data);
    return data;
  }, [applySession]);

  const stopImpersonation = useCallback(async () => {
    const data = await stopImpersonationApi();
    localStorage.removeItem('toms_admin_token');
    applySession(data);
    return data;
  }, [applySession]);

  const fetchImpersonationTargets = useCallback(async () => {
    const data = await getImpersonationTargetsApi();
    return data.targets || [];
  }, []);

  const value = useMemo(() => ({
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
  }), [
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
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
