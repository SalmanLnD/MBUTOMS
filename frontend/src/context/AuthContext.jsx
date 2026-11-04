import { useState, useEffect, useCallback, useMemo } from 'react';
import { createContext, useContext } from 'react';
import {
  login as loginApi,
  logout as logoutApi,
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
import { disableDevicePush, syncDeviceSession } from '../services/deviceService.js';

const AuthContext = createContext(null);

const buildUserData = (data) => ({
  appVersion: data.appVersion,
  _id: data._id,
  name: data.name,
  email: data.email,
  role: data.role === 'demo' ? 'admin' : data.role,
  accountRole: data.role,
  isDemo: Boolean(data.isDemo || data.role === 'demo'),
  demoAccountId: data.demoAccountId || (data.role === 'demo' ? data._id : null),
  trainer: resolveLinkedTrainerId(data.trainer),
  coordinatorSubjects: data.coordinatorSubjects || [],
  evaluatorSubjects: data.evaluatorSubjects || [],
  sessionVersion: data.sessionVersion ?? 1,
  mustResetPassword: Boolean(data.mustResetPassword),
  requiresPasswordReset: Boolean(data.requiresPasswordReset || data.mustResetPassword),
  impersonating: Boolean(data.impersonating),
  impersonator: data.impersonator || null,
});

const storeUser = (userData) => {
  localStorage.setItem('toms_user', JSON.stringify(userData));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('toms_user');
    if (!stored) return null;
    let parsed;
    try { parsed = JSON.parse(stored); } catch { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...parsed,
      trainer: resolveLinkedTrainerId(parsed.trainer),
    };
  });
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data) => {
    resetSessionExpiredState();
    const userData = buildUserData(data);
    storeUser(userData);
    setUser(userData);
    return userData;
  }, []);

  const loadUser = useCallback(async () => {
    localStorage.removeItem('toms_token');
    localStorage.removeItem('toms_admin_token');
    try {
      const userData = await getMe({ skipSessionExpired: true });
      applySession(userData);
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
    if (!loading) void syncDeviceSession(user);
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return undefined;

    const validateSession = async () => {
      try {
        const fresh = await getMe();
        const freshVersion = fresh.sessionVersion ?? 1;
        const cachedVersion = user.sessionVersion ?? 1;
        if (freshVersion !== cachedVersion || fresh.role !== (user.accountRole || user.role)) {
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
  }, [loading, user]);

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

  const logout = useCallback(async () => {
    await disableDevicePush();
    try { await logoutApi(); } catch { /* Clear local state even if the session expired. */ }
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
    const data = await impersonateUserApi(targetUserId);
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
